/**
 * ImpactOS — Authorization Foundation: CONTEXT & ASSIGNMENT ACCESS (SERVICE)
 *
 * Standardized decision path for RESOURCE-SCOPED authorization.
 *
 * Semantics for scoped resources (program / project / venture):
 *
 *   1. Authenticate
 *   2. Super Admin bypass (existing resolver)
 *   3. CAPABILITY  — the resolver decides (eligibility + default/individual
 *                    access + restrictions). Global capabilities remain
 *                    global where they are designed to be (e.g. programs.view
 *                    holders may manage programs globally); this helper does
 *                    NOT grant global access because of an assignment.
 *   4. CONTEXT ASSIGNMENT — the user must actually be assigned to THIS
 *                    resource (v2_program_staff / contact_roles for programs,
 *                    project_members for projects, venture_members for
 *                    ventures).
 *   5. ALLOW / DENY
 *
 * "Capability AND context" — an assignment alone never grants access, and a
 * capability alone never opens a scoped resource. Routes that intend global
 * access keep using requireAuthorization directly; routes that protect a
 * specific resource use requireScopedAccess.
 *
 * No new tables. No new roles. All existing records stay the source of truth.
 *
 * Layer (see docs/LAYER_SPLIT.md): the decision lives here; the per-resource
 * lookups now live in `@/models/authorization/contextAssignmentReads`.
 * `src/models/authorization/context.js` is a re-export facade.
 *
 * NOTE (deferred, same as `requireAuthorization`): this helper still builds the
 * 401/403/500 answers. Refusal-shaping is controller work; it is deliberately
 * left here for now so the response contract every scoped route depends on does
 * not change.
 */

import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { getAuthorizationContext, requireAuthorization } from "./context";
import {
  getProgramStaffAssignmentRows,
  getContactRoleAssignmentRows,
  getProjectMembershipRows,
  getVentureMembershipRows,
} from "@/models/authorization/contextAssignmentReads";

/**
 * Resolve a person's assignment to a specific resource.
 * Returns { source, assignment } or null. Read-only; never fabricates access.
 */
export async function resolveContextAssignment({ resource, contextId, userCid, userEmail = null }) {
  await initDb();
  switch (resource) {
    case "program":
      return resolveProgramAssignment(contextId, userCid, userEmail);
    case "project":
      return resolveProjectAssignment(contextId, userCid);
    case "venture":
      return resolveVentureAssignment(contextId, userCid);
    default:
      return null;
  }
}

/**
 * Program assignment: ANY v2_program_staff row for this program (facilitator,
 * program_manager, assistant, …) OR a current contact_roles 'program'
 * assignment (the generalized layer, which also preserves participant →
 * facilitator history — the previous relationship stays historical via
 * is_current). Organizational membership is deliberately NOT consulted here.
 */
async function resolveProgramAssignment(contextId, userCid, userEmail) {
  const rows = await getProgramStaffAssignmentRows(contextId, userCid, userEmail);
  if (rows.length > 0) return { source: "v2_program_staff", assignment: rows[0] };

  const contactRoleRows = await getContactRoleAssignmentRows(contextId, userCid);
  if (contactRoleRows.length > 0) return { source: "contact_roles", assignment: contactRoleRows[0] };
  return null;
}

async function resolveProjectAssignment(contextId, userCid) {
  const rows = await getProjectMembershipRows(contextId, userCid);
  return rows.length > 0 ? { source: "project_members", assignment: rows[0] } : null;
}

async function resolveVentureAssignment(contextId, userCid) {
  const rows = await getVentureMembershipRows(contextId, userCid);
  return rows.length > 0 ? { source: "venture_members", assignment: rows[0] } : null;
}

/**
 * Route helper — the single scoped decision path.
 * Returns a NextResponse error (401/403/500) or null when allowed.
 *
 * @param {{resource: "program"|"project"|"venture", contextId: string|number,
 *          module: string, capability: string, minLevel?: number}} params
 */
export async function requireScopedAccess({ resource, contextId, module, capability, minLevel = 1 }) {
  try {
    if (!contextId) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }

    // Super Admin bypass — existing resolver semantics.
    const authorizationContext = await getAuthorizationContext(session);
    if (authorizationContext?.isSuperAdmin) return null;

    // CAPABILITY — the resolver decides (eligibility, default/individual
    // access, restrictions). Never bypassed by an assignment.
    const capError = await requireAuthorization(module, capability, minLevel);
    if (capError) return capError;

    // CONTEXT ASSIGNMENT — the person must belong to THIS resource.
    const resolved = await resolveContextAssignment({
      resource,
      contextId,
      userCid: session.cid,
      userEmail: session.email,
    });
    if (!resolved) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }
    return null;
  } catch (error) {
    console.error("[requireScopedAccess] error:", error?.message);
    return NextResponse.json(
      { success: false, error: "errors.authzSystemFailure" },
      { status: 500 },
    );
  }
}
