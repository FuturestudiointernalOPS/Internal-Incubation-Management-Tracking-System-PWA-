/**
 * FEATURE-KEY ALIGNMENT (SERVICE layer).
 *
 * One-time migration: the feature keys were renamed so that FEATURES ARE the
 * dashboard sections (crm, communication, programs, ventures, investors,
 * finance, operations, reports, knowledge, lms, security, settings). Existing
 * databases keep the legacy keys; this migration renames/merges them so the
 * resolver, the eligibility matrix and the responsibility map agree again.
 *
 * Merge rule: an explicit DENY (eligible = 0) wins over any ALLOW row (mirrors
 * `evaluateEligibility`). For responsibilities, the surviving row keeps every
 * user assignment (`user_responsibilities` is re-pointed before the duplicate is
 * deleted).
 *
 * The rule — which key absorbs which, and which row survives — used to sit next
 * to the SQL in `@/models/authorization/backfill.js` (audit A1, finding #8). The
 * statements now live in `@/models/authorization/featureKeyAlignmentStore`;
 * nothing here runs SQL. `backfill.js` calls this so the one-time marker still
 * records the migration (a model→service edge, like `programAssignmentBackfill`).
 */

import { ensureEligibilitySchema } from "@/models/authorization/eligibility";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import {
  mergeFeatureEligibilityKey,
  deleteFeatureEligibilityKey,
  selectResponsibilitiesByKeys,
  renameResponsibilityKey,
  repointUserResponsibilities,
  deleteUserResponsibilitiesForResponsibility,
  deleteResponsibilityById,
} from "@/models/authorization/featureKeyAlignmentStore";

// Legacy feature key → the dashboard-section key it becomes.
export const FEATURE_KEY_RENAMES = {
  program_management: "programs",
  project_ownership: "operations",
  tasks: "operations",
  reporting: "reports",
  investor: "investors",
  user_management: "security",
  system_settings: "settings",
  engineering: "settings",
  knowledge_base: "knowledge",
  intelligence: "knowledge",
  // Legacy per-module feature keys (pre-consolidation) fold into communication.
  messaging: "communication",
  internal_comms: "communication",
};

// Target feature key → the legacy responsibility keys it absorbs.
export const RESPONSIBILITY_MERGES = {
  programs: ["program_management"],
  operations: ["project_ownership", "tasks"],
  reports: ["reporting"],
  investors: ["investor"],
  security: ["user_management"],
  settings: ["system_settings", "engineering"],
  knowledge: ["knowledge_base", "intelligence"],
};

/**
 * Which responsibility row survives a key merge, and which rows fold into it.
 *
 * The row already carrying the target key wins (no re-key needed); otherwise the
 * lowest id wins, so the outcome is deterministic across runs. Every user
 * assignment of a duplicate is re-pointed onto the survivor before the duplicate
 * is deleted — no assignment is ever lost.
 *
 * @param {Array<{id: string|number, key: string}>} rows
 * @param {string} newKey
 * @returns {{survivor: object, dupes: Array}}
 */
export function selectResponsibilitySurvivor(rows, newKey) {
  const sorted = [...rows].sort((first, second) => {
    if ((first.key === newKey) !== (second.key === newKey)) {
      return first.key === newKey ? -1 : 1;
    }
    return Number(first.id) - Number(second.id);
  });
  return { survivor: sorted[0], dupes: sorted.slice(1) };
}

export async function ensureFeatureKeyAlignment() {
  await ensureEligibilitySchema();
  await ensurePermissionsSchema();

  // 1. feature_eligibility — rename + merge with deny-wins.
  for (const [oldKey, newKey] of Object.entries(FEATURE_KEY_RENAMES)) {
    await mergeFeatureEligibilityKey(newKey, oldKey);
    await deleteFeatureEligibilityKey(oldKey);
  }

  // 2. responsibilities — rename/merge, preserving every user assignment.
  for (const [newKey, oldKeys] of Object.entries(RESPONSIBILITY_MERGES)) {
    const rows = (await selectResponsibilitiesByKeys([newKey, ...oldKeys])).rows;
    if (rows.length === 0) continue;

    const { survivor, dupes } = selectResponsibilitySurvivor(rows, newKey);

    if (survivor.key !== newKey) {
      await renameResponsibilityKey(newKey, survivor.id);
    }
    for (const dupe of dupes) {
      await repointUserResponsibilities(survivor.id, dupe.id);
      await deleteUserResponsibilitiesForResponsibility(dupe.id);
      await deleteResponsibilityById(dupe.id);
    }
  }
}
