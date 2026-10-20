/**
 * GENERATED — the action debt (Lot 4, step 4.1).
 *
 * Every API route below is reachable with a session/role gate but NO capability
 * declaration. It is the worklist of step 4.2, frozen so it can only shrink:
 * a new route in this state fails the test, and a route that gains a
 * declaration must be removed from this list.
 *
 * Regenerate with: node scripts/authz-action-debt.mjs --write
 */

export const UNDECLARED_ACTIONS = [
  { file: "src/app/api/auth/invite-family/route.js", category: "a_proteger" },
  { file: "src/app/api/campaigns/[id]/route.js", category: "a_proteger" },
  { file: "src/app/api/campaigns/route.js", category: "a_proteger" },
  { file: "src/app/api/integrations/google-calendar/connect/route.js", category: "a_proteger" },
  { file: "src/app/api/investor/approval/route.js", category: "a_proteger" },
  { file: "src/app/api/investor/campaigns/route.js", category: "a_proteger" },
  { file: "src/app/api/journey-reports/route.js", category: "a_proteger" },
  { file: "src/app/api/platform/collections/route.js", category: "a_proteger" },
  { file: "src/app/api/platform/notifications/route.js", category: "a_proteger" },
  { file: "src/app/api/v2/groups/route.js", category: "a_proteger" },
  { file: "src/app/api/v2/program-staff/route.js", category: "a_proteger" },
  { file: "src/app/api/venture-kpi-definitions/route.js", category: "a_proteger" },
  { file: "src/app/api/venture-options/route.js", category: "a_proteger" },
  { file: "src/app/api/venture-permissions/matrix/route.js", category: "a_proteger" },
  { file: "src/app/api/venture-permissions/responsibilities/route.js", category: "a_proteger" },
  { file: "src/app/api/venture-permissions/scopes/route.js", category: "a_proteger" },
  { file: "src/app/api/venture-plan-templates/apply/route.js", category: "a_proteger" },
  { file: "src/app/api/venture-plan-templates/route.js", category: "a_proteger" },
  { file: "src/app/api/venture-templates/route.js", category: "a_proteger" },
  { file: "src/app/api/ventures/assigned/route.js", category: "a_proteger" },
  { file: "src/app/api/ventures/lead-manager/home/route.js", category: "a_proteger" },
];
