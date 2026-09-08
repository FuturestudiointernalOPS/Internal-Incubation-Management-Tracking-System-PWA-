/**
 * Responsibility ↔ capability alignment (Option 1).
 *
 * grantResponsibilityBaseAccess grants the base `view` capability of every
 * module owned by the responsibility's feature (reverse MODULE_TO_FEATURE),
 * so an assigned responsibility is never a sidebar-only dead-end. Grants are
 * additive and idempotent (ON CONFLICT DO NOTHING).
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

const db = require("@/lib/db").default;
const {
  grantResponsibilityBaseAccess,
  getResponsibilityName,
} = require("@/models/responsibilities");

beforeEach(() => {
  db.execute.mockClear();
});

describe("grantResponsibilityBaseAccess", () => {
  test("grants contacts.view for the crm responsibility", async () => {
    const granted = await grantResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "crm",
      grantedBy: "SA-1",
    });
    expect(granted).toEqual(["contacts.view"]);
    expect(db.execute).toHaveBeenCalledTimes(1);
    const [call] = db.execute.mock.calls[0];
    expect(call.sql).toContain("INSERT INTO user_capabilities");
    expect(call.sql).toContain("ON CONFLICT (user_cid, module, capability) DO NOTHING");
    expect(call.args).toEqual(["USR-1", "contacts", "SA-1"]);
  });

  test("grants one view grant per module of the communication feature", async () => {
    const granted = await grantResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "communication",
      grantedBy: null,
    });
    expect(granted).toEqual(["messaging.view", "internal_comms.view"]);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  test("a responsibility without a module mapping grants nothing (operations)", async () => {
    const granted = await grantResponsibilityBaseAccess({
      userCid: "USR-1",
      responsibilityKey: "operations",
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

describe("getResponsibilityName", () => {
  test("returns name and key for audit + grant lookups", async () => {
    db.execute.mockResolvedValueOnce({ rows: [{ name: "CRM", key: "crm" }] });
    const res = await getResponsibilityName(7);
    expect(res.rows[0]).toEqual({ name: "CRM", key: "crm" });
    expect(db.execute.mock.calls[0][0].sql).toContain("SELECT name, key");
  });
});
