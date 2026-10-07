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
  listActiveInvestorProfiles,
  listActiveLearnerCourses,
  listActiveVentureManagerVentures,
  listActiveParticipantPrograms,
} from "@/models/authorization/contextGrantsStore";

export async function resolveContextDesiredCaps(context, roleKey) {
  const mapping = await getContextRoleProfile(context, roleKey);
  const row = mapping?.rows?.[0];
  if (!row || Number(row.is_active) !== 1 || !row.profile_key) {
    return { profile: null, desired: {}, reason: row ? "unmapped" : "no-registry-row" };
  }
  const capabilitiesResult = await getProfileCapabilityRows(row.profile_key);
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

  // ── Phase E — the newly activated couples (roadmap §7) ─────────────────────
  //
  // Each resolves the relationship to its source ids and then reuses the SAME
  // registry mapping as the couples above: the capability set always comes from
  // the profile the Context Roles registry points the pair at, never from a
  // blanket default. None of these three carries an expiry — the reconcile
  // removes the grant when the relationship itself ends.

  // {investor, investor} — a person with an investor profile.
  if (context === "investor" && roleKey === "investor") {
    const { rows } = await listActiveInvestorProfiles(cid);
    const sourceIds = (rows || []).map((row) => String(row.investor_id)).filter(Boolean);
    return await coupleReport(context, roleKey, sourceIds);
  }

  // {lms, learner} — anyone with access to a course (an active enrollment).
  if (context === "lms" && roleKey === "learner") {
    const { rows } = await listActiveLearnerCourses(cid);
    const sourceIds = (rows || []).map((row) => String(row.course_id)).filter(Boolean);
    return await coupleReport(context, roleKey, sourceIds);
  }

  // {venture, venture_manager} — the lead manager of a venture.
  if (context === "venture" && roleKey === "venture_manager") {
    const ventures = await listActiveVentureManagerVentures(cid);
    const sourceIds = (ventures || []).map((id) => String(id)).filter(Boolean);
    return await coupleReport(context, roleKey, sourceIds);
  }

  // {program, participant} — anyone enrolled in a program. The enrollment row is
  // the relationship, so the grant ends when the enrollment does. The registry
  // maps the pair to the Participant template.
  if (context === "program" && roleKey === "participant") {
    const { rows } = await listActiveParticipantPrograms(cid);
    const sourceIds = (rows || []).map((row) => String(row.program_id)).filter(Boolean);
    return await coupleReport(context, roleKey, sourceIds);
  }

  return null;
}

/**
 * The shared shape for a "relationship → registry profile" couple (Phase E):
 * an empty source set is honestly reported as "no active relationship", so the
 * reconcile withdraws what this couple previously applied rather than silently
 * revoking on an unknown pair.
 */
async function coupleReport(context, roleKey, sourceIds) {
  if (sourceIds.length === 0) {
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
    sourceIds,
    profile: resolved.profile,
    desired: resolved.desired,
    reason: resolved.reason,
    managesExpiry: false,
    expiresAt: null,
  };
}

