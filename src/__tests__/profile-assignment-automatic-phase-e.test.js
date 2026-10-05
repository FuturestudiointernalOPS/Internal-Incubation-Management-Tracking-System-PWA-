/**
 * PHASE E — generalized automatic attribution
 * (docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 * The registry gains its AUTOMATIC half: a business relationship opens an
 * assignment card `source = 'automatic'`, ending it CLOSES the card (never
 * deletes it), and a reactivation opens a NEW period. Three surfaces:
 *
 *   1. the PURE planner — which cards to open / re-date / close from the
 *      relationship ids active right now;
 *   2. the RECONCILE integration — driven through the REAL service over a mocked
 *      database, so the SQL the cards cause is exercised, not stubbed away;
 *   3. the STORE's statement shapes (attributable automatic source, guarded
 *      re-date).
 *
 * The registry DESCRIBES; it decides no access — the grants do — so these tests
 * never assert on `user_capabilities` beyond the safety rule that a card write
 * never disturbs them.
 */

const mockState = {
  founderCids: new Set(), // cids with an ACTIVE founder relationship
  registry: { profile_id: 7, profile_name: "Founder", is_active: 1 },
  profileCaps: [
    { module: "ventures", capability: "view", access_level: 1 },
  ],
  userCaps: [],
  applied: [],
  assignments: [], // profile_assignments rows
  nextId: 1,
};

function mockExecute(query) {
  const sqlText = typeof query === "string" ? query : query.sql || "";
  const args = typeof query === "string" ? [] : query.args || [];

  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sqlText)) return { rows: [] };

  if (sqlText.includes("FROM context_role_profiles")) {
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

  if (sqlText.includes("FROM access_profile_capabilities")) {
    return { rows: mockState.profileCaps };
  }

  if (sqlText.includes("FROM venture_members")) {
    return {
      rows: mockState.founderCids.has(String(args[0]))
        ? [{ venture_id: "VNT-1" }]
        : [],
    };
  }

  // Phase B's registry read: empty → the catalogue default is used.
  if (sqlText.includes("FROM profiles")) return { rows: [] };

  // Phase H — the profile ↔ role rule is enforced ("block"): the founder is a
  // baseline member, so the founder profile (open to member) fits.
  if (sqlText.includes("SELECT role, access_profile_id FROM contacts")) {
    return { rows: [{ role: "member", access_profile_id: null }] };
  }

  // ── Assignment registry ──
  if (sqlText.includes("FROM profile_assignments") && sqlText.includes("source = 'automatic'")) {
    return {
      rows: mockState.assignments.filter(
        (row) =>
          row.contact_cid === String(args[0]) &&
          row.profile_key === args[1] &&
          row.context_type === args[2] &&
          row.source === "automatic" &&
          row.status === "active",
      ),
    };
  }

  if (sqlText.includes("INSERT INTO profile_assignments")) {
    const [contact_cid, profile_key, context_type, context_id, , ends_at, source, source_ref] = args;
    const row = {
      id: mockState.nextId++,
      contact_cid,
      profile_key,
      context_type,
      context_id,
      ends_at,
      source,
      source_ref,
      status: "active",
      ended_at: null,
    };
    mockState.assignments.push(row);
    return { rows: [{ id: row.id }] };
  }

  if (/UPDATE profile_assignments[\s\S]*SET source_ref/i.test(sqlText)) {
    const [source_ref, ends_at, id, cmpRef, cmpEnd] = args;
    const row = mockState.assignments.find((entry) => entry.id === Number(id));
    const moved =
      row && (row.source_ref !== cmpRef || row.ends_at !== cmpEnd);
    if (row && moved) {
      row.source_ref = source_ref;
      row.ends_at = ends_at;
    }
    return { rows: [], rowsAffected: moved ? 1 : 0 };
  }

  if (/UPDATE profile_assignments[\s\S]*SET status/i.test(sqlText)) {
    const [status, endedAt, id] = args;
    const row = mockState.assignments.find(
      (entry) => entry.id === Number(id) && entry.status === "active",
    );
    if (!row) return { rows: [], rowsAffected: 0 };
    row.status = status;
    row.ended_at = endedAt ?? "NOW()";
    return { rows: [], rowsAffected: 1 };
  }

  // ── Grants (the access half, exercised for integration only) ──
  if (sqlText.includes("FROM user_capabilities WHERE user_cid") && !sqlText.includes("DELETE")) {
    return { rows: mockState.userCaps.filter((row) => row.user_cid === String(args[0])) };
  }
  if (sqlText.includes("INSERT INTO user_capabilities")) {
    const [user_cid, module, capability, access_level, granted_by] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (row) => !(row.user_cid === user_cid && row.module === module && row.capability === capability),
    );
    mockState.userCaps.push({ user_cid, module, capability, access_level, granted_by });
    return { rows: [] };
  }
  if (sqlText.includes("DELETE FROM user_capabilities")) {
    const [user_cid, module, capability, granted_by] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.module === module &&
          row.capability === capability &&
          row.granted_by === granted_by
        ),
    );
    return { rows: [] };
  }
  if (sqlText.includes("FROM context_applied_grants") && !sqlText.includes("DELETE")) {
    return {
      rows: mockState.applied.filter(
        (row) => row.user_cid === String(args[0]) && row.context === args[1] && row.role_key === args[2],
      ),
    };
  }
  if (sqlText.includes("INSERT INTO context_applied_grants")) {
    const [user_cid, context, role_key, source_ref, module, capability, access_level] = args;
    mockState.applied = mockState.applied.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.context === context &&
          row.role_key === role_key &&
          row.module === module &&
          row.capability === capability
        ),
    );
    mockState.applied.push({ user_cid, context, role_key, source_ref, module, capability, access_level });
    return { rows: [] };
  }
  if (sqlText.includes("DELETE FROM context_applied_grants")) {
    const [user_cid, context, role_key, module, capability] = args;
    mockState.applied = mockState.applied.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.context === context &&
          row.role_key === role_key &&
          row.module === module &&
          row.capability === capability
        ),
    );
    return { rows: [] };
  }
  if (sqlText.includes("UPDATE context_applied_grants SET source_ref")) {
    const [source_ref, user_cid, context, role_key] = args;
    for (const applied of mockState.applied) {
      if (applied.user_cid === user_cid && applied.context === context && applied.role_key === role_key) {
        applied.source_ref = source_ref;
      }
    }
    return { rows: [] };
  }
  if (sqlText.includes("UPDATE user_capabilities SET expires_at")) return { rows: [] };

  return { rows: [] };
}

const mockDb = { execute: jest.fn(async (query) => mockExecute(query)) };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn(async () => true),
}));

jest.mock("@/services/authorization/context", () => ({
  invalidateAuthorizationContext: jest.fn(),
}));

const {
  planAssignmentCardChanges,
  syncContextGrantsAssignments,
} = require("@/services/authorization/contextGrantAssignments");
const { syncContextGrantsForUser } = require("@/services/authorization/contextGrants");

const CID = "USR_FOUNDER_1";

const sqlOf = (call) => {
  const first = call[0];
  return typeof first === "string" ? first : String(first?.sql || "");
};
const callsMatching = (pattern) =>
  mockDb.execute.mock.calls.filter((call) => pattern.test(sqlOf(call)));

const activeCardsOf = (cid, profileKey) =>
  mockState.assignments.filter(
    (row) =>
      row.contact_cid === cid &&
      row.profile_key === profileKey &&
      row.status === "active",
  );

beforeEach(() => {
  mockState.founderCids = new Set();
  mockState.registry = { profile_id: 7, profile_name: "Founder", is_active: 1 };
  mockState.userCaps = [];
  mockState.applied = [];
  mockState.assignments = [];
  mockState.nextId = 1;
  mockDb.execute.mockClear();
  mockDb.execute.mockImplementation(async (query) => mockExecute(query));
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. The pure planner ──────────────────────────────────────────────────────

describe("planAssignmentCardChanges", () => {
  test("opens one card per relationship id when nothing exists yet", () => {
    const plan = planAssignmentCardChanges({ sourceIds: ["V1", "V2"], activeCards: [] });
    expect(plan.toOpen).toEqual(["V1", "V2"]);
    expect(plan.toRefresh).toEqual([]);
    expect(plan.toClose).toEqual([]);
  });

  test("refreshes an open card whose relationship still holds", () => {
    const plan = planAssignmentCardChanges({
      sourceIds: ["V1"],
      activeCards: [{ id: 5, context_id: "V1" }],
    });
    expect(plan.toOpen).toEqual([]);
    expect(plan.toRefresh).toEqual([{ id: 5, contextId: "V1" }]);
    expect(plan.toClose).toEqual([]);
  });

  test("closes a card whose relationship ended, and opens the new one", () => {
    const plan = planAssignmentCardChanges({
      sourceIds: ["V2"],
      activeCards: [{ id: 5, context_id: "V1" }],
    });
    expect(plan.toOpen).toEqual(["V2"]);
    expect(plan.toClose).toEqual([{ id: 5, contextId: "V1" }]);
  });

  test("no relationship closes every open card", () => {
    const plan = planAssignmentCardChanges({
      sourceIds: [],
      activeCards: [
        { id: 5, context_id: "V1" },
        { id: 6, context_id: "V2" },
      ],
    });
    expect(plan.toOpen).toEqual([]);
    expect(plan.toClose.map((card) => card.id)).toEqual([5, 6]);
  });

  test("blank relationship ids are ignored, never opened as a contextless card", () => {
    const plan = planAssignmentCardChanges({ sourceIds: ["", null, undefined, "V1"] });
    expect(plan.toOpen).toEqual(["V1"]);
  });
});

// ── 2. The reconcile integration ─────────────────────────────────────────────

describe("syncContextGrantsForUser — the automatic assignment card", () => {
  test("an active founder opens a card sourced from the relationship", async () => {
    mockState.founderCids.add(CID);

    const result = await syncContextGrantsForUser(CID);

    expect(result.success).toBe(true);
    expect(result.profileAssignments.opened).toEqual([
      { contextId: "VNT-1", profileKey: "founder", context: "venture" },
    ]);
    const card = activeCardsOf(CID, "founder")[0];
    expect(card).toMatchObject({
      context_type: "venture",
      context_id: "VNT-1",
      source: "automatic",
      source_ref: "VNT-1",
    });
  });

  test("an automatic open is recorded in the audit log (Phase G)", async () => {
    const accessQueries = require("@/models/authorization/accessQueries");
    const spy = jest
      .spyOn(accessQueries, "logPermissionAudit")
      .mockResolvedValue(undefined);
    mockState.founderCids.add(CID);

    await syncContextGrantsForUser(CID);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "profile_assignment_created",
        targetCid: CID,
      }),
    );
    spy.mockRestore();
  });

  test("is idempotent — replaying opens no second card", async () => {
    mockState.founderCids.add(CID);
    await syncContextGrantsForUser(CID);
    const second = await syncContextGrantsForUser(CID);

    expect(second.profileAssignments.opened).toEqual([]);
    expect(second.profileAssignments.refreshed).toEqual([]);
    expect(second.profileAssignments.closed).toEqual([]);
    expect(mockState.assignments).toHaveLength(1);
  });

  test("ending the relationship closes the card, never deletes it", async () => {
    mockState.founderCids.add(CID);
    await syncContextGrantsForUser(CID);

    mockState.founderCids.delete(CID);
    const result = await syncContextGrantsForUser(CID);

    expect(result.profileAssignments.closed).toEqual([
      { contextId: "VNT-1", profileKey: "founder", context: "venture" },
    ]);
    expect(mockState.assignments).toHaveLength(1);
    expect(mockState.assignments[0].status).toBe("ended");
    expect(mockState.assignments[0].ended_at).toBeTruthy();
  });

  test("a reactivation is a NEW period, never a rewrite of the closed one", async () => {
    mockState.founderCids.add(CID);
    await syncContextGrantsForUser(CID);
    mockState.founderCids.delete(CID);
    await syncContextGrantsForUser(CID);
    mockState.founderCids.add(CID);
    await syncContextGrantsForUser(CID);

    expect(mockState.assignments).toHaveLength(2);
    expect(mockState.assignments.filter((row) => row.status === "ended")).toHaveLength(1);
    expect(activeCardsOf(CID, "founder")).toHaveLength(1);
  });

  test("a MANUAL card is never touched by the automatic reconcile", async () => {
    // An administrator already recorded the profile by hand.
    mockState.assignments.push({
      id: mockState.nextId++,
      contact_cid: CID,
      profile_key: "founder",
      context_type: "venture",
      context_id: null,
      ends_at: null,
      source: "manual",
      source_ref: "U-ADMIN",
      status: "active",
      ended_at: null,
    });

    mockState.founderCids.add(CID);
    await syncContextGrantsForUser(CID);
    // The automatic card is a separate row.
    expect(activeCardsOf(CID, "founder")).toHaveLength(2);

    mockState.founderCids.delete(CID);
    await syncContextGrantsForUser(CID);
    // Only the automatic row was closed; the manual one survives.
    const manual = mockState.assignments.find((row) => row.source === "manual");
    expect(manual.status).toBe("active");
    const automatic = mockState.assignments.find((row) => row.source === "automatic");
    expect(automatic.status).toBe("ended");
  });

  test("no relationship and no prior card means no registry write at all", async () => {
    const result = await syncContextGrantsForUser(CID);
    expect(result.profileAssignments.opened).toEqual([]);
    expect(mockState.assignments).toHaveLength(0);
    expect(callsMatching(/INSERT INTO profile_assignments/i)).toHaveLength(0);
  });
});

describe("syncContextGrantsAssignments — the focused entry point", () => {
  test("skips a couple whose profile the catalogue does not know", async () => {
    const result = await syncContextGrantsAssignments(CID, {
      contextType: "venture",
      profileKey: null,
      sourceIds: ["V1"],
    });
    expect(result.skipped).toBe("no-profile");
    expect(mockState.assignments).toHaveLength(0);
  });

  test("reports a store failure as a reason instead of throwing", async () => {
    mockDb.execute.mockImplementationOnce(async () => {
      throw new Error("registry down");
    });
    const result = await syncContextGrantsAssignments(CID, {
      contextType: "venture",
      profileKey: "founder",
      sourceIds: ["V1"],
    });
    expect(result.skipped).toBe("error");
    expect(result.opened).toEqual([]);
  });
});

// ── 3. The store's statement shapes ──────────────────────────────────────────

describe("profile assignments store — automatic rows", () => {
  test("the active-automatic read is scoped to automatic, active rows", async () => {
    const {
      listActiveAutomaticAssignments,
    } = require("@/models/authorization/profileAssignmentsStore");
    await listActiveAutomaticAssignments({
      contactCid: "C1",
      profileKey: "founder",
      contextType: "venture",
    });
    const sql = sqlOf(
      callsMatching(/FROM profile_assignments[\s\S]*source = 'automatic'/i)[0],
    );
    expect(sql).toMatch(/status = 'active'/i);
    expect(sql).toMatch(/context_type = \?/i);
  });

  test("the re-date statement is guarded so a replay moves nothing", async () => {
    const {
      refreshAutomaticAssignmentPeriod,
    } = require("@/models/authorization/profileAssignmentsStore");
    await refreshAutomaticAssignmentPeriod({ id: 5, sourceRef: "V1", endsAt: null });
    const sql = sqlOf(callsMatching(/UPDATE profile_assignments[\s\S]*SET source_ref/i)[0]);
    expect(sql).toMatch(/status = 'active'/i);
    expect(sql).toMatch(/IS DISTINCT FROM/i);
  });
});
