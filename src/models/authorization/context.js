/**
 * ImpactOS — Authorization Foundation: CONTEXT & ASSIGNMENT ACCESS (Phase 8)
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
 */

import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthorizationContext, requireAuthorization } from "@/lib/authorization";

export const CONTEXT_RESOURCES = ["program", "project", "venture"];

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
  const hasEmail = !!(userEmail && String(userEmail).trim());
  const rows = (
    await db.execute({
      sql: hasEmail
        ? `SELECT * FROM v2_program_staff
           WHERE CAST(program_id AS TEXT) = ?
             AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?))
           ORDER BY role LIMIT 1`
        : `SELECT * FROM v2_program_staff
           WHERE CAST(program_id AS TEXT) = ? AND staff_id = ?
           ORDER BY role LIMIT 1`,
      args: hasEmail
        ? [String(contextId), userCid, String(userEmail).trim()]
        : [String(contextId), userCid],
    })
  ).rows;
  if (rows.length > 0) return { source: "v2_program_staff", assignment: rows[0] };

  const cr = (
    await db.execute({
      sql: `SELECT * FROM contact_roles
            WHERE context_type = 'program' AND CAST(context_id AS TEXT) = ?
              AND is_current = true AND contact_cid = ?
            ORDER BY started_at DESC LIMIT 1`,
      args: [String(contextId), userCid],
    })
  ).rows;
  if (cr.length > 0) return { source: "contact_roles", assignment: cr[0] };
  return null;
}

async function resolveProjectAssignment(contextId, userCid) {
  const rows = (
    await db.execute({
      sql: "SELECT 1 FROM project_members WHERE project_id::text = ? AND user_cid = ? LIMIT 1",
      args: [String(contextId), userCid],
    })
  ).rows;
  return rows.length > 0 ? { source: "project_members", assignment: rows[0] } : null;
}

async function resolveVentureAssignment(contextId, userCid) {
  const rows = (
    await db.execute({
      sql: `SELECT 1 FROM venture_members
            WHERE venture_id = ? AND (user_cid = ? OR contact_id = ?)
              AND removed_at IS NULL LIMIT 1`,
      args: [String(contextId), userCid, userCid],
    })
  ).rows;
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
    const ctx = await getAuthorizationContext(session);
    if (ctx?.isSuperAdmin) return null;

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
  } catch (e) {
    console.error("[requireScopedAccess] error:", e?.message);
    return NextResponse.json(
      { success: false, error: "errors.authzSystemFailure" },
      { status: 500 },
    );
  }
}
