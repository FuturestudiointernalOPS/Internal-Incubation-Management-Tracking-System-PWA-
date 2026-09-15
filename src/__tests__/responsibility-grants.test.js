/**
 * Responsibility ↔ capability alignment (Option 1).
 *
 * grantResponsibilityBaseAccess grants the base `view` capability of every
 * module owned by the responsibility's feature (reverse MODULE_TO_FEATURE), so
 * an assigned responsibility is never a sidebar-only dead-end. Grants are
 * additive and idempotent (ON CONFLICT DO NOTHING), and ONLY the grants the
 * responsibility itself created are tracked — so revoking it removes exactly
 * those and never a pre-existing manual grant.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

const db = require("@/lib/db").default;
const {
  grantResponsibilityBaseAccess,
  revokeResponsibilityBaseAccess,
  getResponsibilityName,
} = require("@/models/responsibilities");

/** A fresh grant: the user_capabilities insert returns the row it created. */
const freshGrant = (sql) =>
  String(sql).includes("INSERT INTO user_capabilities")
    ? { rows: [{ module: "m" }] }
    : { rows: [] };

beforeEach(() => {
  db.execute.mockReset();
  db.execute.mockImplementation(async ({ sql }) => freshGrant(sql));
});

describe("grantResponsibilityBaseAccess", () => {
  test("grants contacts.view for the crm responsibility and records the ledger", async () => {
    const granted = await grantResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "crm",
      grantedBy: "SA-1",
    });
    expect(granted).toEqual(["contacts.view"]);
    // One capability insert + one ledger insert per module.
    expect(db.execute).toHaveBeenCalledTimes(2);
    const [grantCall, trackCall] = db.execute.mock.calls;
    expect(grantCall[0].sql).toContain("INSERT INTO user_capabilities");
    expect(grantCall[0].sql).toContain("ON CONFLICT (user_cid, module, capability) DO NOTHING");
    expect(grantCall[0].sql).toContain("RETURNING module");
    expect(grantCall[0].args).toEqual(["USR-1", "contacts", "SA-1"]);
    expect(trackCall[0].sql).toContain("INSERT INTO responsibility_capability_grants");
    expect(trackCall[0].args).toEqual(["USR-1", "crm", "contacts", "view"]);
  });

  test("grants one view grant per module of the communication feature", async () => {
    const granted = await grantResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "communication",
      grantedBy: null,
    });
    expect(granted).toEqual([
      "messaging.view",
      "internal_comms.view",
      "forms.view",
      "runs.view",
    ]);
    expect(db.execute).toHaveBeenCalledTimes(8); // 4 modules × (grant + ledger)
  });

  test("operations owns projects + tasks (dashboard section merge)", async () => {
    const granted = await grantResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "operations",
      grantedBy: "SA-1",
    });
    expect(granted).toEqual(["projects.view", "tasks.view"]);
  });

  test("a capability the user already held is neither reported nor tracked", async () => {
    // A conflicting insert returns no row under ON CONFLICT DO NOTHING.
    db.execute.mockImplementation(async () => ({ rows: [] }));
    const granted = await grantResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "crm",
      grantedBy: "SA-1",
    });
    expect(granted).toEqual([]);
    expect(db.execute).toHaveBeenCalledTimes(1); // the attempt only — no ledger row
    expect(db.execute.mock.calls[0][0].sql).toContain("INSERT INTO user_capabilities");
  });

  test("a responsibility without a module mapping grants nothing (org_membership)", async () => {
    const granted = await grantResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "org_membership",
      grantedBy: "SA-1",
    });
    expect(granted).toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });

  test("missing inputs short-circuit without queries", async () => {
    expect(await grantResponsibilityBaseAccess({ userCid: null, responsibilityKey: "crm" })).toEqual([]);
    expect(await grantResponsibilityBaseAccess({ userCid: "USR-1", responsibilityKey: "" })).toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe("revokeResponsibilityBaseAccess", () => {
  test("revokes exactly the grants this responsibility created", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [{ module: "contacts", capability: "view" }] }) // ledger
      .mockResolvedValueOnce({ rows: [] }) // drop the ledger
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 }); // delete the grant
    const revoked = await revokeResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "crm",
    });
    expect(revoked).toEqual(["contacts.view"]);
    expect(db.execute).toHaveBeenCalledTimes(3);
    const [ledgerCall, dropCall, deleteCall] = db.execute.mock.calls;
    expect(ledgerCall[0].sql).toContain("FROM responsibility_capability_grants");
    expect(dropCall[0].sql).toContain("DELETE FROM responsibility_capability_grants");
    expect(deleteCall[0].sql).toContain("DELETE FROM user_capabilities");
    // Only the base level the responsibility set is removed…
    expect(deleteCall[0].sql).toContain("access_level = 1");
    // …and never a capability another responsibility still tracks.
    expect(deleteCall[0].sql).toContain("responsibility_capability_grants");
    expect(deleteCall[0].args).toEqual([
      "USR-1",
      "contacts",
      "view",
      "USR-1",
      "contacts",
      "view",
    ]);
  });

  test("keeps a capability another responsibility still tracks (nothing deleted)", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [{ module: "contacts", capability: "view" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 0 });
    const revoked = await revokeResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "crm",
    });
    expect(revoked).toEqual([]);
  });

  test("a responsibility with no ledger revokes nothing", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [] }) // empty ledger
      .mockResolvedValueOnce({ rows: [] }); // drop (no-op)
    const revoked = await revokeResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "crm",
    });
    expect(revoked).toEqual([]);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  test("missing inputs short-circuit without queries", async () => {
    expect(await revokeResponsibilityBaseAccess({ userCid: null, responsibilityKey: "crm" })).toEqual([]);
    expect(await revokeResponsibilityBaseAccess({ userCid: "USR-1", responsibilityKey: "" })).toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe("getResponsibilityName", () => {
  test("returns name and key for audit + grant lookups", async () => {
    db.execute.mockResolvedValueOnce({ rows: [{ name: "CRM", key: "crm" }] });
    const res = await getResponsibilityName(7);
    expect(res.rows[0]).toEqual({ name: "CRM", key: "crm" });
    expect(db.execute.mock.calls[0][0].sql).toContain("SELECT name, key");
  });
});
