/**
 * LOT 0 — AUTHZ METRICS RATCHET.
 *
 * The permissions plan starts from a measured baseline. This suite makes that
 * baseline executable:
 *
 *   - debt counters may only go DOWN;
 *   - capability counters may only go UP;
 *   - the facts the plan depends on are frozen until a lot deliberately changes
 *     them (then this test must be updated in the same change).
 *
 * The calculation lives in scripts/lib/authzMetrics.js so the CLI dashboard and
 * this test can never disagree.
 */

const {
  collectMetrics,
  compareToBaseline,
} = require("../../scripts/lib/authzMetrics");
const baseline = require("../../scripts/lib/authzMetricsBaseline.json");

describe("Lot 0 — tableau de bord et cliquet des permissions", () => {
  const metrics = collectMetrics();

  test("les compteurs de dette ne remontent pas et la couverture ne baisse pas", () => {
    const summary = {
      routeFiles: metrics.routes.routeFiles,
      centralCapabilityFiles: metrics.routes.centralCapabilityFiles,
      capabilityFiles: metrics.routes.capabilityFiles,
      capabilityRouteFiles: metrics.routes.capabilityRouteFiles,
      requireAuthOnlyNoCapability:
        metrics.routes.strictRequireAuthOnlyNoCapability,
      withoutCapability: metrics.routes.withoutCapabilityByCategory,
      hardcodedRoleLists: metrics.roleGates.hardcodedRoleListsInActions,
      roleMotifLines: metrics.roleGates.roleMotifLineTotal,
      staticGuardExceptions: metrics.roleGates.staticGuardExceptions,
      extendedGuardExceptions: metrics.roleGates.extendedGuardExceptions,
      pmOnlyRoleGates: metrics.roleGates.pmOnlyRoleGates,
      pmRoleDecisions: metrics.roleVocabulary.pmRoleDecisions,
      pmOccurrences: metrics.roleVocabulary.pmOccurrences,
      loginRoleValues: metrics.roleVocabulary.loginRoleValuesUnion,
      legacyContextualLoginValues:
        metrics.roleVocabulary.legacyContextualLoginValues.length,
      historicalAccessRoles: metrics.roleVocabulary.historicalRoles.length,
      scopePolicies: metrics.scope.policies.length,
      programScopeCalls: metrics.scope.programScopeCalls,
      programScopeWithCapability: metrics.scope.programScopeWithCapability,
      ventureFullCalls: metrics.scope.ventureFullCalls,
      legacyVentureCalls: metrics.scope.legacyVentureCalls,
      unifiedScopedCalls: metrics.scope.unifiedScopedCalls,
    };
    // Published in the test output: this IS the dashboard at every run.
    console.log("[authz-metrics]", JSON.stringify(summary, null, 2));

    expect(compareToBaseline(metrics, baseline)).toEqual([]);
  });

  test("les faits de départ restent vrais (Lot 1 inclus)", () => {
    expect(metrics.facts.loginRoutesShareResolver).toBe(true);
    expect(metrics.facts.sessionLoginHasNoOwnProgramManagerBranch).toBe(true);
    expect(["role", "staff"]).toContain(
      metrics.facts.programManagerIdentityMode,
    );
    expect(metrics.facts.canonicalResolverSupportsStaffMode).toBe(true);
    expect(metrics.facts.ventureRosterCommentMatchesCode).toBe(true);
    expect(metrics.facts.facilitatorGuardReadsAssignmentJson).toBe(true);
    expect(metrics.facts.facilitatorGrantsWritePersonalRights).toBe(true);
  });
});
