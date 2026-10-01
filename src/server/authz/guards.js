/**
 * server/authz — resource guards.
 *
 * The 401/403/404/409 answers for program- and project-scoped endpoints. Each
 * returns null when the request may proceed, or the NextResponse to return
 * as-is — which is why routes read:
 *
 *   const authError = await requireAssignmentAccess({ ... });
 *   if (authError) return authError;
 *
 * These are authorization decisions ("may this account touch this resource?"),
 * not authentication ones: they run once an identity exists.
 *
 * The DECISION now lives in `@/services/authorization/resourceGuards` (HTTP-free,
 * testable without a request); this module is the HTTP boundary that turns the
 * decision into a `NextResponse`. The public signatures are unchanged, so every
 * caller reads exactly as before.
 */

import { NextResponse } from "next/server";
import {
  evaluateProjectAccess,
  evaluateProgramFacilitator,
  evaluateFacilitatorProgramAccess,
  evaluateParticipantFacilitatorConflict,
  evaluateAssignmentAccess,
} from "@/services/authorization/resourceGuards";

/** Map a decision to the refusal response, or null when it is allowed. */
function toResponse({ allowed, status, errorKey }) {
  if (allowed) return null;
  return NextResponse.json({ success: false, error: errorKey }, { status });
}

/**
 * requireProjectAccess — Auth guard for project-scoped endpoints.
 *
 * Allows access if the user is:
 *   1. Authenticated AND
 *   2. A super_admin, OR the project owner, OR a project member
 *
 * Usage:
 *   const authError = await requireProjectAccess(projectId);
 *   if (authError) return authError;
 */
export async function requireProjectAccess(projectId) {
  return toResponse(await evaluateProjectAccess(projectId));
}

/**
 * Guard: requires the session user to hold a facilitator assignment for the
 * program. The assignment is the source of truth — the legacy global
 * 'facilitator' role is no longer checked here. Super admin / staff / PM
 * keep their existing bypass access.
 */
export async function requireProgramFacilitator(programId) {
  return toResponse(await evaluateProgramFacilitator(programId));
}

/**
 * Convenience guard for delivery APIs (participants, attendance, submissions,
 * sessions). Assignment-derived: access follows the v2_program_staff assignment
 * rather than the legacy global role. Bypass roles are unaffected — existing
 * access is preserved.
 */
export async function enforceFacilitatorProgramAccess(programId, capability = null, minLevel = 1) {
  return toResponse(await evaluateFacilitatorProgramAccess(programId, capability, minLevel));
}

/**
 * Same-program conflict guard (Phase 2A): rejects participant enrollment when
 * the person already holds a facilitator assignment in the SAME program.
 *
 * Returns a 409 NextResponse when a conflict exists, otherwise null.
 * Fail-open on lookup errors so enrollment flows never break on transient
 * issues (the guard is a consistency layer; the facilitator-assignment side
 * already enforces the same rule at write time).
 */
export async function assertNoParticipantFacilitatorConflict(
  programId,
  contactCid,
  contactEmail = null,
) {
  return toResponse(await evaluateParticipantFacilitatorConflict(programId, contactCid, contactEmail));
}

/**
 * General assignment-aware authorization primitive.
 *
 * Program resources delegate to the existing, proven facilitator path so current
 * behavior is preserved exactly. Non-program resources are not wired yet and are
 * denied. `requireStatus` optionally enforces an assignment status on top.
 */
export async function requireAssignmentAccess(params) {
  return toResponse(await evaluateAssignmentAccess(params));
}
