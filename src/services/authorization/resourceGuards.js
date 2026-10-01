/**
 * Authorization — RESOURCE GUARDS (SERVICE layer).
 *
 * The decisions behind the resource guards in `@/server/authz/guards`: "may this
 * account touch this resource?" Each answers with the same decision object the
 * rest of the authorization service uses —
 *
 *     { allowed: boolean, status: number, errorKey: string|null }
 *
 * — so the HTTP boundary (`@/server/authz/guards`, via `@/server/authz/responses`)
 * is the only place a decision becomes an HTTP response. This module stays
 * HTTP-free: it reads through `@/models/authorization/accessQueries` and never
 * imports the HTTP layer (enforced by
 * `src/__tests__/server/services-boundaries.test.js`).
 *
 * The public guard signatures are unchanged, so every route keeps calling
 * `requireProjectAccess` / `requireAssignmentAccess` / … exactly as before.
 */

import { requireSession } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { FACILITATOR_BYPASS_ROLES } from "@/server/authz/capabilities";
import { resolveProgramAssignment, getFacilitatorPermissionLevel } from "@/server/authz/programAccess";
import {
  projectExists,
  isProjectMember,
  findParticipantFacilitatorConflict,
  getAssignmentStatus,
} from "@/models/authorization/accessQueries";

const ALLOWED = { allowed: true, status: 200, errorKey: null };
const denied = (status, errorKey) => ({ allowed: false, status, errorKey });

/**
 * Project-scoped access. Allowed when the caller is a super_admin, the project
 * owner or a project member; 404 when the project does not exist.
 */
export async function evaluateProjectAccess(projectId) {
  try {
    const session = await requireSession(); // any authenticated user

    // Super_admin bypass
    if (session.role === "super_admin") return ALLOWED;

    if (!(await projectExists(projectId))) return denied(404, "Project not found");

    // Member or lead (covers both owners and collaborators)
    if (await isProjectMember(projectId, session.cid)) return ALLOWED;

    return denied(403, "errors.insufficientPermissions");
  } catch (err) {
    if (err.message === "Unauthorized") return denied(401, "errors.authRequired");
    return denied(500, "errors.authSystemFailure");
  }
}

/**
 * The caller must hold a facilitator assignment for the program. The assignment
 * is the source of truth — the legacy global 'facilitator' role is not checked
 * here. Super admin keeps its bypass.
 */
export async function evaluateProgramFacilitator(programId) {
  try {
    const session = await getSession();
    if (!session) return denied(401, "errors.authRequired");
    if (session.role === "super_admin") return ALLOWED;
    const resolved = await resolveProgramAssignment(programId, session.cid, session.email);
    if (!resolved) return denied(403, "errors.insufficientPermissions");
    return ALLOWED;
  } catch {
    return denied(500, "errors.authzSystemFailure");
  }
}

/**
 * The delivery-API guard (participants, attendance, submissions, sessions):
 * assignment-derived access with an optional capability + minimum level.
 * Bypass roles are unaffected.
 */
export async function evaluateFacilitatorProgramAccess(programId, capability = null, minLevel = 1) {
  try {
    const session = await getSession();
    if (!session) return denied(401, "errors.authRequired");
    if (session.role === "super_admin") return ALLOWED;
    const resolved = await resolveProgramAssignment(programId, session.cid, session.email);
    if (!resolved) return denied(403, "errors.insufficientPermissions");
    if (capability) {
      const level = await getFacilitatorPermissionLevel(programId, resolved.assignment, capability);
      if (level < minLevel) return denied(403, "errors.insufficientPermissions");
    }
    return ALLOWED;
  } catch {
    return denied(500, "errors.authzSystemFailure");
  }
}

/**
 * Same-program conflict guard: a 409 when the person already holds a facilitator
 * assignment in the SAME program. Fail-open on lookup errors so enrollment flows
 * never break on transient issues (the assignment side enforces the same rule at
 * write time).
 */
export async function evaluateParticipantFacilitatorConflict(programId, contactCid, contactEmail = null) {
  try {
    if (!programId || !contactCid) return ALLOWED;
    const conflict = await findParticipantFacilitatorConflict(programId, contactCid, contactEmail);
    if (conflict) return denied(409, "errors.roleConflictParticipantFacilitator");
    return ALLOWED;
  } catch (error) {
    console.error("assertNoParticipantFacilitatorConflict error:", error.message);
    return ALLOWED;
  }
}

/**
 * General assignment-aware authorization primitive. Program resources delegate to
 * the facilitator path so behavior is preserved exactly; non-program resources
 * are not wired yet and are denied. `requireStatus` optionally enforces an
 * assignment status on top.
 */
export async function evaluateAssignmentAccess({
  resource = "program",
  contextId,
  capability = null,
  minLevel = 1,
  requireStatus = null,
}) {
  try {
    const session = await getSession();
    if (!session) return denied(401, "errors.authRequired");

    if (FACILITATOR_BYPASS_ROLES.includes(session.role)) return ALLOWED;

    if (resource !== "program") return denied(403, "errors.insufficientPermissions");

    const base = await evaluateFacilitatorProgramAccess(contextId, capability, minLevel);
    if (!base.allowed) return base;

    if (requireStatus) {
      const status = await getAssignmentStatus(resource, contextId, session.cid);
      if (status !== requireStatus) return denied(403, "errors.insufficientPermissions");
    }

    return ALLOWED;
  } catch {
    return denied(500, "errors.authzSystemFailure");
  }
}
