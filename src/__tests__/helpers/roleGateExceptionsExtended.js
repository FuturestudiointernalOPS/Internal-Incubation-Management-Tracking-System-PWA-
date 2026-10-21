/**
 * GUARD-EXT-1 — role-gate exception list for the four mechanisms NOT covered by
 * the M1–M4 ratchet (const ROLE, ROLE_ACCESS, PERSONAL_ROLES,
 * requireVentureAccess). The legacy role_capabilities motif is retired.
 *
 * GENERATED (read-only scan of `src`, production only: `src/__tests__` and the
 * engine directories excluded) on 2026-10-10. Every entry is a
 * `<path>#<motif>` pair that EXISTS today. The ratchet test fails if a NEW pair
 * appears OR if a listed pair disappears — so this list can only be reviewed
 * downward, never silently grown.
 *
 * BUCKETS:
 *   - decision : mechanisms that decide ACCESS (requireVentureAccess)
 *   - display  : role constants / navigation masks — reviewed as NOT access
 *                decisions; ratcheted so a NEW one still surfaces for review.
 *
 * Counts measured 2026-10-19: decision 25, display 25.
 */
module.exports = {
  generatedAt: "2026-10-10",
  decision: [

  ],
  display: [
    "src/app/admin/crm/page.js#M5",
    "src/app/admin/ventures/[id]/founders/page.js#M5",
    "src/app/api/kpis/route.js#M5",

    "src/app/api/ventures/[id]/advisors/route.js#M5",
    "src/app/api/ventures/[id]/coaching/route.js#M5",
    "src/app/api/ventures/[id]/documents/[docId]/permissions/route.js#M5",
    "src/app/api/ventures/[id]/documents/[docId]/reviews/route.js#M5",
    "src/app/api/ventures/[id]/documents/[docId]/transition/route.js#M5",
    "src/app/api/ventures/[id]/documents/[docId]/versions/route.js#M5",
    "src/app/api/ventures/[id]/documents/route.js#M5",
    "src/app/api/ventures/[id]/progress/route.js#M5",
    "src/app/crm/contacts/page.js#M5",
    "src/app/workspaces/page.js#M5",
    "src/components/crm/TimelineScreen.js#M5",
    "src/components/crm/people-detail/constants.js#M5",
    "src/components/layout/shell/useDashboardNavigation.js#M7",
    "src/lib/masterNavigation.js#M6",
    "src/lib/masterNavigation/access.js#M5",
    "src/lib/masterNavigation/access.js#M6",
    "src/lib/masterNavigation/builders.js#M6",
    "src/models/platform/roles.js#M5",
  ],
};
