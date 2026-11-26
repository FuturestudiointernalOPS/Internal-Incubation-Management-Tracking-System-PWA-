/**
 * The staff space — its contexts.
 *
 * A staff account always has the CORE context (the dashboard, the weekly
 * report, tasks, projects). The others open from what the person actually
 * holds, never from a label alone:
 *
 *   lead-manager     at least one venture assignment
 *   program-manager  at least one managed programme
 *   finance          the finance responsibility (capability-driven)
 *   crm              the CRM responsibility (capability-driven)
 *
 * Finance and CRM are decided by the capability projection (`buildAccessNav`),
 * so they are not listed here: a context listed here is one the SHELL must
 * explicitly add a door for.
 *
 * `src/components/layout/shell/useDashboardNavigation.js` used to test these
 * conditions inline. It asks this file now.
 */

import {
  isInternalStaffRole,
  isLegacyProgramManagerRole,
} from "@/lib/identity";

export const STAFF_CONTEXTS = [
  {
    key: "core",
    labelKey: "contexts.staff.core",
    when: () => true,
  },
  {
    key: "lead-manager",
    labelKey: "contexts.staff.leadManager",
    when: ({ role, ventureAssignCount }) =>
      (isInternalStaffRole(role) || isLegacyProgramManagerRole(role)) &&
      typeof ventureAssignCount === "number" &&
      ventureAssignCount > 0,
  },
  {
    key: "program-manager",
    labelKey: "contexts.staff.programManager",
    when: ({ pmPrograms }) => Array.isArray(pmPrograms) && pmPrograms.length > 0,
  },
];

/** The contexts this person actually holds right now. */
export function activeStaffContexts(signals = {}) {
  return STAFF_CONTEXTS.filter((context) => context.when(signals));
}

/** Whether one context is active, by key. */
export function hasStaffContext(signals, key) {
  return activeStaffContexts(signals).some((context) => context.key === key);
}
