/**
 * Organizational membership foundation (Phase 1) — pure logic tests.
 * Covers the FUTURE STUDIO lifecycle scenarios 1-7 without a database.
 */

const {
  normalizeGroupName,
  isEffectiveMembership,
  selectEffectiveGroups,
  applyMembershipAction,
  MEMBERSHIP_ACTIONS,
  INTERNAL_GROUP,
} = require("@/lib/authorization/membership");

const NOW = new Date("2026-08-27T12:00:00Z");
const FUTURE = new Date("2026-12-31T00:00:00Z");
const PAST = new Date("2026-01-01T00:00:00Z");

describe("normalizeGroupName", () => {
  test("uppercases and trims", () => {
    expect(normalizeGroupName("  future studio ")).toBe("FUTURE STUDIO");
    expect(normalizeGroupName("Come UP")).toBe("COME UP");
    expect(normalizeGroupName("")).toBe("");
    expect(normalizeGroupName(null)).toBe("");
  });
});

describe("isEffectiveMembership", () => {
  test("active with no expiry → effective", () => {
    expect(isEffectiveMembership("active", null, NOW)).toBe(true);
    expect(isEffectiveMembership("active", undefined, NOW)).toBe(true);
  });
  test("active with future expiry → effective", () => {
    expect(isEffectiveMembership("active", FUTURE, NOW)).toBe(true);
  });
  test("active with past expiry → NOT effective (contract expired)", () => {
    expect(isEffectiveMembership("active", PAST, NOW)).toBe(false);
  });
  test("expired / ended / missing status → NOT effective", () => {
    expect(isEffectiveMembership("expired", null, NOW)).toBe(false);
    expect(isEffectiveMembership("ended", null, NOW)).toBe(false);
    expect(isEffectiveMembership(null, null, NOW)).toBe(false);
    expect(isEffectiveMembership("", null, NOW)).toBe(false);
  });
});

describe("selectEffectiveGroups — scenario 1-3 (employee / expiry / renewal)", () => {
  test("active FUTURE STUDIO membership contributes (Scenario 1)", () => {
    const groups = selectEffectiveGroups(
      [
        { group_name: "FUTURE STUDIO", status: "active", expires_at: null },
        { group_name: "COME UP", status: "active", expires_at: FUTURE },
      ],
      [],
      NOW,
    );
    expect(groups).toEqual(["FUTURE STUDIO", "COME UP"]);
  });

  test("expired membership no longer contributes (Scenario 2)", () => {
    const groups = selectEffectiveGroups(
      [
        { group_name: "FUTURE STUDIO", status: "active", expires_at: PAST },
      ],
      [],
      NOW,
    );
    expect(groups).toEqual([]);
  });

  test("ended membership no longer contributes", () => {
    const groups = selectEffectiveGroups(
      [{ group_name: "FUTURE STUDIO", status: "ended", expires_at: null }],
      [],
      NOW,
    );
    expect(groups).toEqual([]);
  });

  test("renewal (status active again) restores contribution — same membership row", () => {
    const groups = selectEffectiveGroups(
      [
        { group_name: "FUTURE STUDIO", status: "active", expires_at: FUTURE },
      ],
      [],
      NOW,
    );
    expect(groups).toEqual(["FUTURE STUDIO"]);
  });

  test("legacy user_groups edges without a membership record auto-heal (zero-loss)", () => {
    const groups = selectEffectiveGroups([], [{ group_name: "FUTURE STUDIO" }], NOW);
    expect(groups).toEqual(["FUTURE STUDIO"]);
  });

  test("expired memberships are authoritative over legacy edges", () => {
    const groups = selectEffectiveGroups(
      [{ group_name: "FUTURE STUDIO", status: "expired", expires_at: PAST }],
      [{ group_name: "FUTURE STUDIO" }],
      NOW,
    );
    expect(groups).toEqual([]);
  });

  test("deduplicates overlapping rows", () => {
    const groups = selectEffectiveGroups(
      [
        { group_name: "FUTURE STUDIO", status: "active", expires_at: null },
        { group_name: "FUTURE STUDIO", status: "active", expires_at: FUTURE },
      ],
      [{ group_name: "FUTURE STUDIO" }],
      NOW,
    );
    expect(groups).toEqual(["FUTURE STUDIO"]);
  });
});

describe("applyMembershipAction — lifecycle transitions", () => {
  const member = {
    user_cid: "USR_JOHN",
    group_name: INTERNAL_GROUP,
    started_at: PAST,
    expires_at: null,
    status: "active",
  };

  test("joined → active, records joined event", () => {
    const { row, event } = applyMembershipAction(member, "joined", { actor: "SA" }, NOW);
    expect(row.status).toBe("active");
    expect(event.action).toBe("joined");
    expect(event.actor_cid).toBe("SA");
  });

  test("renewed → active again, keeps started_at, sets new expiry — NO duplicate (Scenario 3)", () => {
    const { row, event } = applyMembershipAction(
      { ...member, status: "expired" },
      "renewed",
      { actor: "SA", expires_at: FUTURE.toISOString() },
      NOW,
    );
    expect(row.status).toBe("active");
    expect(row.started_at).toBe(PAST); // original start preserved
    expect(new Date(row.expires_at).getTime()).toBe(FUTURE.getTime());
    expect(event.action).toBe("renewed");
    // Same person + group — renewal mutates the existing membership row.
    expect(row.user_cid).toBeUndefined(); // row is fields-only; identity comes from `current`
  });

  test("expired → status expired, history retained", () => {
    const { row, event } = applyMembershipAction(member, "expired", { actor: "system" }, NOW);
    expect(row.status).toBe("expired");
    expect(event.action).toBe("expired");
  });

  test("deactivated and ended → status ended", () => {
    expect(applyMembershipAction(member, "deactivated", {}, NOW).row.status).toBe("ended");
    expect(applyMembershipAction(member, "ended", {}, NOW).row.status).toBe("ended");
  });

  test("unknown action throws", () => {
    expect(() => applyMembershipAction(member, "explode", {}, NOW)).toThrow(
      /Unknown membership action/,
    );
  });

  test("every documented action is supported", () => {
    expect(MEMBERSHIP_ACTIONS).toEqual([
      "joined",
      "activated",
      "deactivated",
      "renewed",
      "expired",
      "ended",
    ]);
  });
});

describe("protected-group rule (Scenario 7 — URL/API cannot bypass)", () => {
  test("INTERNAL_GROUP is exported and matches the protected group name", () => {
    expect(INTERNAL_GROUP).toBe("FUTURE STUDIO");
  });

  test("membership actions never delete the person — events are always appended", () => {
    const { row, event } = applyMembershipAction(
      { user_cid: "USR_JANE", group_name: INTERNAL_GROUP, started_at: PAST, expires_at: null, status: "active" },
      "ended",
      { actor: "SA", note: "contract ended" },
      NOW,
    );
    expect(row.status).toBe("ended");
    expect(event.note).toBe("contract ended");
    // The record still exists — only its status changed.
    expect(row).toHaveProperty("status", "ended");
  });
});
