/**
 * Authorization — organizational membership decisions (SERVICE layer).
 *
 * The membership lifecycle rules and the effective-group composition. They used
 * to sit inside the membership repository next to the SQL; they are pure (or
 * composition) and are now here, reading through
 * `@/models/authorization/membership`.
 *
 * Unchanged rules:
 *   - a membership contributes to authorization only while active and unexpired;
 *   - legacy edges WITHOUT a membership record auto-heal as active (zero-loss);
 *   - a renewal UPDATES the existing row — never a duplicate person.
 *
 * The shared vocabulary (`INTERNAL_GROUP`, `MEMBERSHIP_ACTIONS`) and
 * `normalizeGroupName` stay in the repository, since the repository's bootstrap
 * needs them too.
 */

import {
  MEMBERSHIP_ACTIONS,
  getMembershipRowsForUser,
} from "@/models/authorization/membership";

/** A membership contributes to authorization only while active and unexpired. */
export function isEffectiveMembership(status, expiresAt, now = new Date()) {
  if (String(status || "").toLowerCase() !== "active") return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > now.getTime();
}

/**
 * Pure effective-group selection.
 *
 * - Active, unexpired membership rows are effective.
 * - Legacy rows (user_groups edges with NO membership record) are treated as
 *   active — auto-heal so nothing ever silently loses access. Expired
 *   memberships are authoritative over any legacy edge (callers should only
 *   emit legacy rows when no membership record exists).
 *
 * @param {Array<{group_name, status, expires_at}>} membershipRows
 * @param {Array<{group_name}>} legacyRows
 * @param {Date} [now]
 * @returns {string[]} effective group names
 */
export function selectEffectiveGroups(membershipRows = [], legacyRows = [], now = new Date()) {
  const effective = [];
  const seen = new Set();
  // Any group with a membership record is governed by that record — a stale
  // legacy edge must never resurrect an expired/ended membership.
  const hasMembershipRecord = new Set(
    (membershipRows || []).map((row) => row.group_name),
  );
  for (const row of membershipRows || []) {
    if (isEffectiveMembership(row.status, row.expires_at, now) && !seen.has(row.group_name)) {
      seen.add(row.group_name);
      effective.push(row.group_name);
    }
  }
  for (const row of legacyRows || []) {
    if (hasMembershipRecord.has(row.group_name)) continue;
    if (!seen.has(row.group_name)) {
      seen.add(row.group_name);
      effective.push(row.group_name);
    }
  }
  return effective;
}

/**
 * Pure lifecycle transition: computes the new membership row + the event to
 * record for an action. NEVER duplicates the person — renewal updates the
 * existing row.
 *
 * @param {{user_cid, group_name, started_at, expires_at, status}} current
 * @param {string} action  one of MEMBERSHIP_ACTIONS
 * @param {{actor?: string, note?: string, expires_at?: string|null}} options
 *   options.expires_at applies to joined/activated/renewed (null = no expiry).
 * @param {Date} [now]
 * @returns {{row: {status, started_at, expires_at}, event: {action, actor_cid, note}}}
 */
export function applyMembershipAction(current, action, options = {}, now = new Date()) {
  const normalizedAction = String(action || "").toLowerCase();
  if (!MEMBERSHIP_ACTIONS.includes(normalizedAction)) {
    throw new Error(`Unknown membership action: ${action}`);
  }
  const event = {
    action: normalizedAction,
    actor_cid: options.actor || null,
    note: options.note || null,
  };
  switch (normalizedAction) {
    case "joined":
      return {
        row: {
          status: "active",
          started_at: current.started_at || now,
          expires_at: options.expires_at !== undefined ? options.expires_at : current.expires_at ?? null,
        },
        event,
      };
    case "activated":
      return {
        row: {
          status: "active",
          started_at: current.started_at || now,
          expires_at: options.expires_at !== undefined ? options.expires_at : current.expires_at ?? null,
        },
        event,
      };
    case "renewed":
      return {
        row: {
          status: "active",
          started_at: current.started_at || now,
          // Renewal keeps the original start and sets a new expiry (null = no expiry).
          expires_at: options.expires_at !== undefined ? options.expires_at : null,
        },
        event,
      };
    case "deactivated":
      return { row: { status: "ended", started_at: current.started_at || now, expires_at: current.expires_at ?? null }, event };
    case "expired":
      return { row: { status: "expired", started_at: current.started_at || now, expires_at: current.expires_at ?? null }, event };
    case "ended":
      return { row: { status: "ended", started_at: current.started_at || now, expires_at: current.expires_at ?? null }, event };
    default:
      throw new Error(`Unknown membership action: ${action}`);
  }
}

/**
 * Effective groups AND the ended memberships, from ONE read.
 *
 * @returns {Promise<{groups: string[], history: Array<{group_name: string, status: string, started_at: any, expires_at: any}>}>}
 */
export async function getEffectiveGroupsAndHistory(cid) {
  const result = await getMembershipRowsForUser(cid);

  const membershipRows = result.rows.filter((row) => row.source === "membership");
  const legacyRows = result.rows.filter((row) => row.source === "legacy");

  // The ended memberships, newest first. Two details are carried over from the
  // query this replaces rather than re-decided here: a NULL status was EXCLUDED
  // by `status != 'active'` in SQL, so it is excluded here too; and Postgres puts
  // NULLs FIRST on a descending order, so an absent start date sorts to the top
  // rather than the bottom.
  const startedAt = (value) => (value == null ? Infinity : new Date(value).getTime());
  const history = membershipRows
    .filter((row) => row.status != null && row.status !== "active")
    .map((row) => ({
      group_name: row.group_name,
      status: row.status,
      started_at: row.started_at,
      expires_at: row.expires_at,
    }))
    .sort((first, second) => startedAt(second.started_at) - startedAt(first.started_at));

  return {
    groups: selectEffectiveGroups(membershipRows, legacyRows),
    history,
  };
}

/**
 * Effective groups for a user (single query, egress-neutral):
 * active memberships + legacy user_groups edges without a membership record.
 */
export async function getEffectiveGroupsForUser(cid) {
  const { groups } = await getEffectiveGroupsAndHistory(cid);
  return groups;
}
