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
 *
 * `shadow` is now EMPTY: the program transition probe was removed once its one
 * divergence was explained (Lot 8). The count below is the assertion that no
 * rule is measured in shadow without a deliberate decision.
 */

jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => {}) }));

const {
  SCOPE_POLICY_KEYS,
  SCOPE_POLICIES,
} = require("@/models/authorization/scope-catalog");
const {
  ENFORCED_SCOPE_POLICY,
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
      enforced: 3, // venture_own, program_managed, program_staffed (repair route)
      display: 2, // program_assigned, learning_own
      history: 2, // venture_managed_history, program_managed_history
    });
  });

  test("the unified decision uses only enforced policies", () => {
    const enforced = new Set(
      Object.values(SCOPE_POLICIES)
        .filter((policy) => policy.purpose === "enforced")
        .map((policy) => policy.key),
    );

    for (const policy of Object.values(ENFORCED_SCOPE_POLICY)) {
      expect(enforced.has(policy)).toBe(true);
    }
  });

  test("the staffing rule is enforced by the repair route, not by the decision", () => {
    expect(SCOPE_POLICIES.program_staffed.purpose).toBe("enforced");
    expect(Object.values(ENFORCED_SCOPE_POLICY)).not.toContain("program_staffed");
  });
});
