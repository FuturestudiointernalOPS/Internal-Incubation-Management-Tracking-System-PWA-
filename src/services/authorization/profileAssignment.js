/**
 * PROFILE ASSIGNMENT DECISIONS (SERVICE layer).
 *
 * Assigning or removing an access-profile override is one of the highest-risk
 * permission writes: it silently REPLACES a person's base capabilities. The
 * rules lived inside `src/app/api/access-profiles/assign/route.js`; the route now
 * only orchestrates HTTP.
 *
 * Rules, unchanged:
 *   - Separation of duties: nobody changes their OWN access profile — not even a
 *     Super Admin. Self-granting capabilities is the escalation this refuses.
 *   - Eligibility is the boundary: a template assigned to a person must never
 *     grant capabilities the person's identity (role + groups) is not eligible
 *     for (`ELIGIBLE ≠ GRANTED`).
 *   - Capability-loss guard: the resolver reads `access_profile_capabilities`
 *     INSTEAD OF `role_capabilities`, so an empty or narrower profile strips
 *     access without any visible error. The loss must be made explicit and
 *     accepted with `confirm: true` before proceeding.
 *   - A loss is computed against the LEVEL, not mere presence: dropping a
 *     capability from level 3 to level 1 is a loss.
 *
 * Every statement is in `@/models/authorization` (the repository); nothing here
 * runs SQL and nothing here builds a Response.
 */

import { assertTemplateCapsEligible } from "@/services/authorization/eligibilityAdmin";
import { getUserGroupNames } from "@/models/authorization";
import { listActiveProfileKeys } from "@/models/authorization/profileAssignmentsStore";

/**
 * Separation of duties.
 *
 * @param {{cid?: string}|null|undefined} session
 * @param {string} userCid
 * @returns {boolean} true when the caller is trying to change their OWN profile
 */
export function isSelfAssignment(session, userCid) {
  if (!session?.cid || !userCid) return false;
  return String(session.cid) === String(userCid);
}

/**
 * Eligibility boundary for an assignment: the profile must not grant
 * capabilities the TARGET person is not eligible for. The person's identity is
 * their role, their group names, and (Phase D) the profiles they hold.
 *
 * @returns {Promise<{valid: boolean, violations: Array}>}
 */
export async function assertAssignmentEligible(user, userCid, profileId) {
  const groups = (await getUserGroupNames(userCid)).rows.map((row) => row.group_name);
  let profiles = [];
  try {
    profiles = ((await listActiveProfileKeys(userCid)).rows || []).map((row) =>
      String(row.profile_key),
    );
  } catch {
    // A missing registry table reads as "no profile" — never a failed write.
    profiles = [];
  }
  return assertTemplateCapsEligible({
    role: user?.role,
    groups,
    profiles,
    profileId,
  });
}

const capKey = (cap) => `${cap.module}:${cap.capability}`;

/**
 * Computes what an assignment would REMOVE and ADD for a person, and decides
 * whether that loss must be confirmed.
 *
 * "Removed" = held today but not re-granted at an equal-or-higher level.
 * "Gained"  = the reverse: newly held, or held at a higher level.
 *
 * The `removed` payload is capped at 25 entries for the response body; the
 * counts always stay exact so the UI can say "and N more".
 *
 * @param {{source: string, profileName?: string, caps: Array}} current
 * @param {Array} newCaps rows of the profile being assigned
 * @param {string} newProfileName
 * @returns {{loss: object, refusal: {error: string, message: string}|null}}
 *   `refusal` is non-null when the caller must send `confirm: true`.
 */
export function evaluateCapabilityLoss(current, newCaps, newProfileName) {
  const rows = newCaps || [];

  const currentLevels = new Map(current.caps.map((cap) => [capKey(cap), cap.access_level]));
  const newLevels = new Map(
    rows.map((cap) => [capKey(cap), Number(cap.access_level) || 0]),
  );

  const removed = current.caps
    .filter((cap) => (newLevels.get(capKey(cap)) || 0) < cap.access_level)
    .map((cap) => ({
      module: cap.module,
      capability: cap.capability,
      level: cap.access_level,
    }));
  const gained = rows
    .filter((cap) => Number(cap.access_level) > (currentLevels.get(capKey(cap)) || 0))
    .map((cap) => ({
      module: cap.module,
      capability: cap.capability,
      level: Number(cap.access_level) || 0,
    }));

  const loss = {
    currentSource: current.source,
    currentProfileName: current.profileName || null,
    currentCount: current.caps.length,
    newProfileName,
    newCount: rows.length,
    removedCount: removed.length,
    gainedCount: gained.length,
    removed: removed.slice(0, 25), // capped payload — counts stay exact
  };

  // An empty profile is the more severe case: it strips EVERYTHING.
  if (rows.length === 0) {
    return {
      loss,
      refusal: {
        error: "profile_assignment_empty_profile",
        message: `That profile grants no capabilities. Assigning it removes all ${loss.removedCount} capabilities this user has today.`,
      },
    };
  }

  if (removed.length > 0) {
    return {
      loss,
      refusal: {
        error: "profile_assignment_removes_capabilities",
        message: `This profile grants fewer capabilities than the user has today: ${loss.removedCount} will be removed, ${loss.gainedCount} added.`,
      },
    };
  }

  return { loss, refusal: null };
}

/**
 * What a person falls back to once their override is removed. Reported to the
 * caller so the UI can say where the access now comes from.
 *
 * @returns {string|null} the role-default profile name, or null for legacy
 */
export function resolveRemovalFallback(roleDefaultName) {
  return roleDefaultName || null;
}