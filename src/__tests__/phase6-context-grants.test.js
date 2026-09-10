/**
 * PHASE 6 — CONTEXT → PROFILE APPLICATION.
 *
 * Locks the approved design:
 *   1. An active venture founder receives the capabilities of the profile the
 *      Context Roles registry maps for venture:founder — as additive grants
 *      stamped `ctx:venture:founder`.
 *   2. Manual grants (any other granted_by) are NEVER overwritten or removed.
 *   3. When the last founder relationship ends (or the mapping is cleared),
 *      the applied grants are withdrawn — and only those.
 *   4. Baseline identity is never touched.
 */

const mockState = {
  founderCids: new Set(), // cids with an ACTIVE founder relationship
  registry: { profile_id: 7, profile_name: "Founder", is_active: 1 },
  registryMissing: false,
  profileCaps: [
    { module: "ventures", capability: "view", access_level: 1 },
    { module: "ventures", capability: "edit", access_level: 3 },
  ],
  userCaps: [], // { user_cid, module, capability, access_level, granted_by }
  applied: [], // { user_cid, context, role_key, module, capability, access_level, source_ref }
};

function mockExecute(query) {
  const q = typeof query === "string" ? query : query.sql || "";
  const args = typeof query === "string" ? [] : query.args || [];

  if (q.includes("CREATE TABLE") || q.includes("CREATE INDEX")) return { rows: [] };

  if (q.includes("FROM context_role_profiles")) {
    if (mockState.registryMissing) return { rows: [] };
    return {
      rows: [
        {
          id: 1,
          context: "venture",
          role_key: "founder",
          profile_id: mockState.registry.profile_id,
          is_active: mockState.registry.is_active,
          profile_name: mockState.registry.profile_name,
        },
      ],
    };
  }

  if (q.includes("FROM access_profile_capabilities")) {
    return { rows: mockState.profileCaps };
  }

  if (q.includes("FROM venture_members")) {
    if (args.length === 0) {
      return { rows: [...mockState.founderCids].map((cid) => ({ cid })) };
    }
    return {
      rows: mockState.founderCids.has(String(args[0])) ? [{ venture_id: "VNT-1" }] : [],
    };
  }

  if (q.includes("DISTINCT user_cid AS cid FROM context_applied_grants")) {
    const ids = [...new Set(mockState.applied.map((r) => r.user_cid))];
    return { rows: ids.map((cid) => ({ cid })) };
  }

  if (q.includes("FROM user_capabilities WHERE user_cid") && !q.includes("DELETE")) {
    return { rows: mockState.userCaps.filter((r) => r.user_cid === String(args[0])) };
  }

  if (q.includes("INSERT INTO user_capabilities")) {
    const [user_cid, module, capability, access_level, granted_by] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (r) => !(r.user_cid === user_cid && r.module === module && r.capability === capability),
    );
    mockState.userCaps.push({ user_cid, module, capability, access_level, granted_by });
    return { rows: [] };
  }

  if (q.includes("DELETE FROM user_capabilities")) {
    const [user_cid, module, capability, granted_by] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (r) =>
        !(
          r.user_cid === user_cid &&
          r.module === module &&
          r.capability === capability &&
          r.granted_by === granted_by
        ),
    );
    return { rows: [] };
  }

  if (q.includes("FROM context_applied_grants WHERE user_cid") && !q.includes("DELETE")) {
    return {
      rows: mockState.applied.filter(
        (r) => r.user_cid === String(args[0]) && r.context === args[1] && r.role_key === args[2],
      ),
    };
  }

  if (q.includes("INSERT INTO context_applied_grants")) {
    const [user_cid, context, role_key, source_ref, module, capability, access_level] = args;
    mockState.applied = mockState.applied.filter(
      (r) =>
        !(
          r.user_cid === user_cid &&
          r.context === context &&
          r.role_key === role_key &&
          r.module === module &&
          r.capability === capability
        ),
    );
    mockState.applied.push({ user_cid, context, role_key, source_ref, module, capability, access_level });
    return { rows: [] };
  }

  if (q.includes("DELETE FROM context_applied_grants WHERE user_cid")) {
    const [user_cid, context, role_key, module, capability] = args;
    mockState.applied = mockState.applied.filter(
      (r) =>
        !(
          r.user_cid === user_cid &&
          r.context === context &&
          r.role_key === role_key &&
          r.module === module &&
          r.capability === capability
        ),
    );
    return { rows: [] };
  }

  if (q.includes("UPDATE context_applied_grants SET source_ref")) {
    const [source_ref, user_cid, context, role_key] = args;
    for (const r of mockState.applied) {
      if (r.user_cid === user_cid && r.context === context && r.role_key === role_key) {
        r.source_ref = source_ref;
      }
    }
    return { rows: [] };
  }

  return { rows: [] };
}

const mockDb = { execute: jest.fn(async (query) => mockExecute(query)) };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn(async () => true),
}));

jest.mock("@/models/authorization/resolver", () => ({
  invalidateAuthorizationContext: jest.fn(),
}));

const {
  planContextGrantChanges,
  contextGrantSentinel,
  syncContextGrantsForUser,
  syncAllContextGrants,
} = require("@/models/authorization/contextGrants");

const SENTINEL = contextGrantSentinel("venture", "founder");

function ours(cid, module, capability) {
  return mockState.userCaps.filter(
    (r) => r.user_cid === cid && r.module === module && r.capability === capability && r.granted_by === SENTINEL,
  );
}

beforeEach(() => {
  mockState.founderCids = new Set();
  mockState.registry = { profile_id: 7, profile_name: "Founder", is_active: 1 };
  mockState.registryMissing = false;
  mockState.userCaps = [];
  mockState.applied = [];
  mockDb.execute.mockClear();
});

describe("planContextGrantChanges (pure)", () => {
  const desired = {
    "ventures.view": { module: "ventures", capability: "view", level: 1 },
    "ventures.edit": { module: "ventures", capability: "edit", level: 3 },
  };

  test("applies every desired capability when nothing exists yet", () => {
    const { toApply, toRevoke } = planContextGrantChanges({ desired, sentinel: SENTINEL });
    expect(toApply.map((i) => `${i.module}.${i.capability}`)).toEqual(["ventures.view", "ventures.edit"]);
    expect(toRevoke).toEqual([]);
  });

  test("never overwrites a manual grant", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [{ module: "ventures", capability: "view", access_level: 1, granted_by: "USER_SA" }],
      sentinel: SENTINEL,
    });
    expect(toApply.map((i) => i.capability)).toEqual(["edit"]);
  });

  test("does not rewrite a row this mechanism already applied at the same level", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [{ module: "ventures", capability: "view", access_level: 1, granted_by: SENTINEL }],
      sentinel: SENTINEL,
    });
    expect(toApply.map((i) => i.capability)).toEqual(["edit"]);
  });

  test("updates an applied row whose level changed (profile edited)", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [{ module: "ventures", capability: "view", access_level: 0, granted_by: SENTINEL }],
      sentinel: SENTINEL,
    });
    expect(toApply.map((i) => i.capability)).toEqual(["view", "edit"]);
    expect(toApply[0].level).toBe(1);
  });

  test("revokes applied rows that are no longer desired", () => {
    const { toRevoke } = planContextGrantChanges({
      desired: { "ventures.view": desired["ventures.view"] },
      provenance: [
        { module: "ventures", capability: "view" },
        { module: "ventures", capability: "edit" },
      ],
      sentinel: SENTINEL,
    });
    expect(toRevoke).toEqual([{ module: "ventures", capability: "edit" }]);
  });
});

describe("syncContextGrantsForUser (apply / revoke)", () => {
  const CID = "USR_FOUNDER_1";

  test("an active founder receives the mapped profile capabilities (stamped)", async () => {
    mockState.founderCids.add(CID);
    const result = await syncContextGrantsForUser(CID);

    expect(result.success).toBe(true);
    expect(result.profile).toBe("Founder");
    expect(result.ventures).toEqual(["VNT-1"]);
    expect(result.applied.sort()).toEqual(["ventures.edit", "ventures.view"]);
    expect(result.revoked).toEqual([]);

    expect(ours(CID, "ventures", "view")).toHaveLength(1);
    expect(ours(CID, "ventures", "edit")).toHaveLength(1);
    // Provenance mirrors the applied rows (source = the venture codes).
    expect(mockState.applied).toHaveLength(2);
    expect(mockState.applied[0].source_ref).toBe("VNT-1");
    expect(mockState.applied[0].context).toBe("venture");
    expect(mockState.applied[0].role_key).toBe("founder");
  });

  test("is idempotent — a second run changes nothing", async () => {
    mockState.founderCids.add(CID);
    await syncContextGrantsForUser(CID);
    const second = await syncContextGrantsForUser(CID);
    expect(second.applied).toEqual([]);
    expect(second.revoked).toEqual([]);
    expect(mockState.userCaps).toHaveLength(2);
  });

  test("when the last founder relationship ends, only our grants are removed", async () => {
    mockState.founderCids.add(CID);
    await syncContextGrantsForUser(CID);

    // The person also holds a manual grant on another module.
    mockState.userCaps.push({
      user_cid: CID,
      module: "contacts",
      capability: "view",
      access_level: 1,
      granted_by: "USER_SA",
    });

    mockState.founderCids.delete(CID); // removed from every venture
    const result = await syncContextGrantsForUser(CID);

    expect(result.revoked.sort()).toEqual(["ventures.edit", "ventures.view"]);
    expect(ours(CID, "ventures", "view")).toHaveLength(0);
    expect(ours(CID, "ventures", "edit")).toHaveLength(0);
    // The manual grant survives untouched.
    expect(mockState.userCaps).toHaveLength(1);
    expect(mockState.userCaps[0].module).toBe("contacts");
    expect(mockState.applied).toHaveLength(0);
  });

  test("a manual grant is never overwritten while the relationship is active", async () => {
    mockState.founderCids.add(CID);
    mockState.userCaps.push({
      user_cid: CID,
      module: "ventures",
      capability: "view",
      access_level: 5,
      granted_by: "USER_SA",
    });
    const result = await syncContextGrantsForUser(CID);

    expect(result.applied).toEqual(["ventures.edit"]); // view belonged to the admin
    const viewRow = mockState.userCaps.find((r) => r.capability === "view");
    expect(viewRow.access_level).toBe(5);
    expect(viewRow.granted_by).toBe("USER_SA");
  });

  test("an unmapped registry entry revokes what we applied before", async () => {
    mockState.founderCids.add(CID);
    await syncContextGrantsForUser(CID);

    mockState.registry = { profile_id: null, profile_name: null, is_active: 1 };
    const result = await syncContextGrantsForUser(CID);

    expect(result.profile).toBe(null);
    expect(result.reason).toBe("unmapped");
    expect(result.revoked.sort()).toEqual(["ventures.edit", "ventures.view"]);
    expect(mockState.userCaps).toHaveLength(0);
  });
});

describe("syncAllContextGrants (backfill / drift repair)", () => {
  test("covers relationship holders and previously-granted people", async () => {
    mockState.founderCids.add("USR_A");
    mockState.applied.push({
      user_cid: "USR_B", // relationship already ended — must be reconciled
      context: "venture",
      role_key: "founder",
      module: "ventures",
      capability: "view",
      access_level: 1,
      source_ref: "VNT-9",
    });
    mockState.userCaps.push({
      user_cid: "USR_B",
      module: "ventures",
      capability: "view",
      access_level: 1,
      granted_by: SENTINEL,
    });

    const report = await syncAllContextGrants();

    expect(report.success).toBe(true);
    expect(report.evaluated).toBe(2);
    expect(report.applied.sort()).toEqual(["ventures.edit", "ventures.view"]); // USR_A
    expect(report.revoked).toEqual(["ventures.view"]); // USR_B (no relationship left)
    expect(report.changes).toBe(3);
  });
});
