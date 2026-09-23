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
 */

import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { FACILITATOR_BYPASS_ROLES } from "./capabilities";
import { resolveProgramAssignment, getFacilitatorPermissionLevel } from "./programAccess";
import {
  projectExists,
  isProjectMember,
  findParticipantFacilitatorConflict,
  getAssignmentStatus,
} from "@/models/authorization/accessQueries";


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
  try {
    const session = await requireSession(); // any authenticated user

    // Super_admin bypass
    if (session.role === "super_admin") return null;

    // Check if project exists
    if (!(await projectExists(projectId))) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 },
      );
    }

    // Check if user is a project member or lead (covers both owners and collaborators)
    if (await isProjectMember(projectId, session.cid)) return null;

    // Deny
    return NextResponse.json(
      { success: false, error: "errors.insufficientPermissions" },
      { status: 403 },
    );
  } catch (err) {
    if (err.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: "errors.authSystemFailure" },
      { status: 500 },
    );
  }
}

/**
 * Guard: requires the session user to hold a facilitator assignment for the
 * program. The assignment is the source of truth — the legacy global
 * 'facilitator' role is no longer checked here. Super admin / staff / PM
 * keep their existing bypass access.
 */
export async function requireProgramFacilitator(programId) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    if (session.role === "super_admin") return null;
    const resolved = await resolveProgramAssignment(programId, session.cid, session.email);
    if (!resolved)
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    return null;
  } catch {
    return NextResponse.json(
      { success: false, error: "errors.authzSystemFailure" },
      { status: 500 },
    );
  }
}

/**
 * Convenience guard for delivery APIs (participants, attendance, submissions,
 * sessions). Assignment-derived: access follows the v2_program_staff assignment
 * rather than the legacy global role. Bypass roles are unaffected — existing
 * access is preserved.
 */
export async function enforceFacilitatorProgramAccess(programId, capability = null, minLevel = 1) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    if (session.role === "super_admin") return null;
    const resolved = await resolveProgramAssignment(programId, session.cid, session.email);
    if (!resolved)
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    if (capability) {
      const level = await getFacilitatorPermissionLevel(programId, resolved.assignment, capability);
      if (level < minLevel)
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
    }
    return null;
  } catch {
    return NextResponse.json(
      { success: false, error: "errors.authzSystemFailure" },
      { status: 500 },
    );
  }
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
  try {
    if (!programId || !contactCid) return null;
    const conflict = await findParticipantFacilitatorConflict(programId, contactCid, contactEmail);
    if (conflict) {
      return NextResponse.json(
        { success: false, error: "errors.roleConflictParticipantFacilitator" },
        { status: 409 },
      );
    }
    return null;
  } catch (error) {
    console.error("assertNoParticipantFacilitatorConflict error:", error.message);
    return null;
  }
}

/**
 * General assignment-aware authorization primitive.
 *
 * Program resources delegate to the existing, proven facilitator path so current
 * behavior is preserved exactly. Non-program resources are not wired yet and are
 * denied. `requireStatus` optionally enforces an assignment status on top.
 */
export async function requireAssignmentAccess({
  resource = "program",
  contextId,
  capability = null,
  minLevel = 1,
  requireStatus = null,
}) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );

    if (FACILITATOR_BYPASS_ROLES.includes(session.role)) return null;

    if (resource !== "program") {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    const base = await enforceFacilitatorProgramAccess(
      contextId,
      capability,
      minLevel,
    );
    if (base) return base;

    if (requireStatus) {
      const status = await getAssignmentStatus(resource, contextId, session.cid);
      if (status !== requireStatus) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

    return null;
  } catch {
    return NextResponse.json(
      { success: false, error: "errors.authzSystemFailure" },
      { status: 500 },
    );
  }
}
