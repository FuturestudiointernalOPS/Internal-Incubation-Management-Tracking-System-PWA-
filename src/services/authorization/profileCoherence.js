/**
 * PROFILE / CAPABILITY COHERENCE (SERVICE layer).
 *
 * ONE periodic report, two directions:
 *
 *   - CARDS  — an active profile card whose profile is missing/inactive, or
 *              carries no capability. Read from the existing
 *              `listProfileAssignmentConsistency`; not duplicated here.
 *   - RIGHTS — a capability row whose profile does not exist.
 *
 * It logs ONE warning when the two drift apart and returns the detail for the
 * scheduled endpoint. It NEVER writes: correcting silently would hide the bug
 * that created the drift.
 */

import { listProfileAssignmentConsistency } from "@/models/authorization/profileAssignmentsStore";
import { listCapabilitiesWithoutProfile } from "@/models/authorization/profileCoherence";

/**
 * @returns {Promise<{coherent: boolean, brokenCards: number, profiles: Array, orphanCapabilities: Array}>}
 */
export async function checkProfileCapabilityCoherence() {
  const [cards, orphanCapabilities] = await Promise.all([
    listProfileAssignmentConsistency(),
    listCapabilitiesWithoutProfile(),
  ]);

  const profiles = (cards.rows || [])
    .map((row) => ({
      profileKey: row.profile_key,
      activeCards: Number(row.active_cards) || 0,
      profileWithoutRights: Number(row.profile_without_rights) || 0,
      profileWithoutCapabilities: Number(row.profile_without_capabilities) || 0,
    }))
    .filter(
      (row) => row.profileWithoutRights > 0 || row.profileWithoutCapabilities > 0,
    );

  const brokenCards = profiles.reduce(
    (total, row) => total + row.profileWithoutRights + row.profileWithoutCapabilities,
    0,
  );

  const report = {
    coherent: brokenCards === 0 && (orphanCapabilities.rows || []).length === 0,
    brokenCards,
    profiles,
    orphanCapabilities: orphanCapabilities.rows || [],
  };

  if (!report.coherent) {
    console.warn(
      "[authz] profile/capability coherence drift (reported, never corrected)",
      report,
    );
  }

  return report;
}
