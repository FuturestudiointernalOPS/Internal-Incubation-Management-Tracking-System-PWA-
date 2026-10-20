/**
 * Lot 3.5 — the scope policy set, classified.
 *
 * Seven policies exist for four different reasons. This suite keeps the reasons
 * visible and stops a replaced rule from quietly becoming enforced again:
 *
 *   enforced — protects a request;
 *   display  — fills a screen or a context projection, never a write;
 *   history  — the residual read of a former relationship;
 *   shadow   — the rule a switch replaced; measured, never called by a route.
 */

jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => {}) }));

const {
  SCOPE_POLICY_KEYS,
  SCOPE_POLICIES,
} = require("@/models/authorization/scope-catalog");
const {
  ENFORCED_SCOPE_POLICY,
  SHADOW_SCOPE_POLICY,
} = require("@/services/authorization/scopedAccess");

describe("the scope policy set", () => {
  test("the catalogue and the key list never drift", () => {
    expect(Object.keys(SCOPE_POLICIES).sort()).toEqual([...SCOPE_POLICY_KEYS].sort());
  });

  test("every policy is classified, and the mix is the documented one", () => {
    const byPurpose = {};
    for (const policy of Object.values(SCOPE_POLICIES)) {
      byPurpose[policy.purpose] = (byPurpose[policy.purpose] || 0) + 1;
    }

    expect(byPurpose).toEqual({
      enforced: 2, // venture_own, program_managed
      display: 2, // program_assigned, learning_own
      history: 2, // venture_managed_history, program_managed_history
      shadow: 1, // program_staffed — D-4 replaced it
    });
  });

  test("the decision enforces exactly the enforced policies", () => {
    const enforced = Object.values(SCOPE_POLICIES)
      .filter((policy) => policy.purpose === "enforced")
      .map((policy) => policy.key)
      .sort();

    expect(Object.values(ENFORCED_SCOPE_POLICY).sort()).toEqual(enforced);
  });

  test("the replaced program rule is measured, never enforced", () => {
    expect(SCOPE_POLICIES.program_staffed.purpose).toBe("shadow");
    expect(Object.values(ENFORCED_SCOPE_POLICY)).not.toContain("program_staffed");
    expect(SHADOW_SCOPE_POLICY.program).toBe("program_staffed");
  });
});
