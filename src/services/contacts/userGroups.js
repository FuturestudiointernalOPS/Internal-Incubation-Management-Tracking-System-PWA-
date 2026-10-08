/**
 * USER GROUPS (legacy group membership API) — the read + sync use-cases.
 *
 * The GET fallback chain (the `user_groups` table first, then the legacy
 * `contacts.group_name`) and the join/leave orchestration: write the raw edge,
 * drop the caller's cached authorization context so it is effective immediately,
 * then keep the membership layer in sync (active, no expiry) with history.
 *
 * The decisions — the fallback order, the normalized group name, the
 * membership-sync-only-if-missing rule and the freshness invalidation — live
 * here; every statement is in `@/models/groups`. Nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { invalidateAuthorizationContext } from "@/services/authorization";
import {
  normalizeGroupName,
  getMembership,
} from "@/models/authorization/membership";
import {
  applyMembershipAction,
} from "@/services/authorization/membership";
import {
  getUserGroups,
  getContactLegacyGroup,
  assignUserToGroup,
  createGroupMembership,
  createGroupMembershipEvent,
  unassignUserFromGroup,
  endGroupMembership,
  createGroupMembershipEndEvent,
} from "@/models/groups/userGroups";

/**
 * Every group a user belongs to — the `user_groups` table when it exists
 * (migration pending otherwise), falling back to the legacy `group_name`.
 */
export async function listUserGroups(userCid) {
  // First try user_groups table (may not exist yet — migration pending)
  let groups = [];
  try {
    const result = await getUserGroups(userCid);
    groups = result.rows.map((row) => row.group_name);
  } catch {
    // user_groups table may not exist yet — fall through to legacy group_name
    groups = [];
  }

  // Fallback to legacy group_name on contacts
  if (groups.length === 0) {
    try {
      const contactResult = await getContactLegacyGroup(userCid);
      if (contactResult.rows.length > 0 && contactResult.rows[0].group_name) {
        groups = [contactResult.rows[0].group_name];
      }
    } catch (_) {}
  }

  return groups;
}

/**
 * Add a user to a group. `actorCid` is the caller's cid ("admin" when unknown).
 */
export async function joinUserGroup({ userCid, groupName, actorCid }) {
  const normalized = normalizeGroupName(groupName);
  await assignUserToGroup(userCid, normalized);
  // P1 freshness: group membership feeds group_capabilities + group eligibility
  // rows — drop the user's cached context so the new edge is effective
  // immediately (freshness mechanism only; server authorization stays
  // authoritative).
  invalidateAuthorizationContext(userCid);
  // Keep the membership layer in sync so the new edge is effective immediately
  // (active, no expiry) and has history.
  const existing = await getMembership(userCid, normalized);
  if (!existing) {
    const { row, event } = applyMembershipAction(
      { user_cid: userCid, group_name: normalized, started_at: null, expires_at: null, status: null },
      "joined",
      { actor: "admin" },
    );
    await createGroupMembership(
      userCid,
      normalized,
      row.started_at,
      row.expires_at,
      row.status,
      actorCid || "admin",
    );
    await createGroupMembershipEvent(
      userCid,
      normalized,
      event.action,
      event.actor_cid,
      "legacy group API",
    );
  }
}

/**
 * Remove a user from a group. `actorCid` is the caller's cid ("admin" when
 * unknown). The membership record is ENDED (never deleted), so the person,
 * account, CRM record and history stay; only active authorization stops.
 */
export async function leaveUserGroup({ userCid, groupName, actorCid }) {
  const normalized = normalizeGroupName(groupName);
  await unassignUserFromGroup(userCid, normalized);
  // P1 freshness: same rationale as join — membership removal must not linger in
  // the cached authorization context.
  invalidateAuthorizationContext(userCid);
  const existing = await getMembership(userCid, normalized);
  if (existing) {
    await endGroupMembership(actorCid || "admin", userCid, normalized);
    await createGroupMembershipEndEvent(
      userCid,
      normalized,
      actorCid || "admin",
    );
  }
}
