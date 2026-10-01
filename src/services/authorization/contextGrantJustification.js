/**
 * CONTEXT GRANT JUSTIFICATION (SERVICE layer).
 *
 * "Why do these grants exist, and what should they be?" — one dispatch for the
 * three supported context roles, so the reconcile path stays identical for all
 * of them. Returns null for an unsupported pair, and the CALLER reports that
 * rather than silently revoking: refusing an unknown pair must never be
 * mistaken for "the relationship ended".
 *
 * The two families resolve differently, on purpose:
 *
 *   - venture:founder — the registry maps the pair to a profile; the active
 *     founder relationship only justifies its EXISTENCE. No expiry: a founder
 *     grant does not end on a date.
 *   - program:facilitator — the PER-PROGRAM TICK LIST is the source of truth.
 *     The grant reflects what the assignments actually grant, never a blanket
 *     default; a capability ticked off in every program disappears on the next
 *     reconcile.
 *   - program:program_manager — the registry decides the profile.
 *
 * Both program roles carry `managesExpiry: true` with the LATEST program end
 * date, so the resolver stops honouring the grant on its own once the program
 * is over — the grant does not need a cron to be withdrawn.
 *
 * Split out of `contextGrants.js` (538 lines). Behaviour identical.
 */

import { getContextRoleProfile } from "@/models/authorization/contextRoleProfiles";
import {
  listActiveProgramAssignments,
  loadAssignmentLookups,
} from "@/models/authorization/programAssignmentReads";
import {
  assignmentsForRole,
  deriveFacilitatorDesiredCaps,
  deriveAssignmentsExpiry,
} from "./programAssignments";
import {
  getProfileCapabilityRows,
  listActiveFounderVentures,
} from "@/models/authorization/contextGrantsStore";

export async function resolveContextDesiredCaps(context, roleKey) {
  const mapping = await getContextRoleProfile(context, roleKey);
  const row = mapping?.rows?.[0];
  if (!row || Number(row.is_active) !== 1 || !row.profile_id) {
    return { profile: null, desired: {}, reason: row ? "unmapped" : "no-registry-row" };
  }
  const capabilitiesResult = await getProfileCapabilityRows(row.profile_id);
  const desired = {};
  for (const capabilityRow of capabilitiesResult.rows || []) {
    desired[`${capabilityRow.module}.${capabilityRow.capability}`] = {
      module: capabilityRow.module,
      capability: capabilityRow.capability,
      level: Number(capabilityRow.access_level ?? 1),
    };
  }
  return { profile: row.profile_name || null, desired, reason: "mapped" };
}

/**
 * Why do these grants exist, and what should they be? One place for the three
 * supported context roles, so the reconcile path stays identical for all of
 * them. Returns null for an unsupported pair (the caller reports it rather than
 * silently revoking).
 *
 * `expiresAt` is only produced for the PROGRAM contexts: program access ends
 * with the program, so the grant carries the latest program end date and the
 * resolver stops honouring it on its own once that date passes.
 */
export async function resolveContextJustification(cid, { context, roleKey, email }) {
  if (context === "venture" && roleKey === "founder") {
    const ventures = await listActiveFounderVentures(cid);
    if (ventures.length === 0) {
      return {
        sourceIds: [],
        profile: null,
        desired: {},
        reason: "no active relationship",
        managesExpiry: false,
        expiresAt: null,
      };
    }
    const resolved = await resolveContextDesiredCaps(context, roleKey);
    return {
      sourceIds: ventures,
      profile: resolved.profile,
      desired: resolved.desired,
      reason: resolved.reason,
      managesExpiry: false,
      expiresAt: null,
    };
  }

  if (
    context === "program" &&
    (roleKey === "facilitator" || roleKey === "program_manager")
  ) {
    const { rows } = await listActiveProgramAssignments(cid, { email });
    const mine = assignmentsForRole(rows, roleKey);
    const sourceIds = mine.map((assignment) => String(assignment.program_id));
    if (mine.length === 0) {
      return {
        sourceIds,
        profile: null,
        desired: {},
        reason: "no active relationship",
        managesExpiry: true,
        expiresAt: null,
      };
    }
    const expiresAt = deriveAssignmentsExpiry(mine);
    if (roleKey === "facilitator") {
      // The FACILITATOR's per-program tick list is the source of truth: the
      // grant must reflect what the assignments actually grant, never a
      // blanket default. A capability ticked off in every program disappears
      // from the grant on the next reconcile.
      const lookups = await loadAssignmentLookups(mine);
      const { desired } = deriveFacilitatorDesiredCaps(mine, lookups);
      return {
        sourceIds,
        profile: "Facilitator assignment (per-program permissions)",
        desired,
        reason: Object.keys(desired).length ? "assigned" : "no per-program rights",
        managesExpiry: true,
        expiresAt,
      };
    }
    // Program manager: the Context Roles registry decides the profile.
    const resolved = await resolveContextDesiredCaps(context, roleKey);
    return {
      sourceIds,
      profile: resolved.profile,
      desired: resolved.desired,
      reason: resolved.reason,
      managesExpiry: true,
      expiresAt,
    };
  }

  return null;
}

