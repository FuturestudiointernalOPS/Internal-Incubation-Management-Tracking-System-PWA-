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
 * Layer (see docs/LAYER_SPLIT.md): this service is HTTP-free. It answers with a
 * decision object; the 401/403/500 response is built by the HTTP boundary in
 * `@/server/authz/responses`. That is what routes and controllers use. The
 * per-resource lookups live in
 * `@/models/authorization/contextAssignmentReads`.
 */

import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { getAuthorizationContext, evaluateAuthorization } from "./context";
import { AUTHZ_REASONS } from "./contextDecisions";
import { isWithinScope, resolveVentureScopeId } from "./scope";
import { shadowCheck, shadowEnabled } from "./shadow";
import {
  getProgramStaffAssignmentRows,
  getContactRoleAssignmentRows,
  getProjectMembershipRows,
  getVentureMembershipRows,
} from "@/models/authorization/contextAssignmentReads";

/**
 * c3a — the ENGINE scope policy a scoped `resource` maps to, for the shadow
 * comparison. Resources with no engine policy (project) are simply not probed.
 *
 * ALIGNMENT (Phase 5 c3b) — `program` → **`program_managed`**: the perimeter
 * retained for the eventual switch is the PROFILE basis (the `program_manager`
 * profile assignment), not a staff table. The shadow therefore measures the
 * legacy ad-hoc decision against the policy that would REPLACE it. The route
 * guard still enforces `program_staffed` today (see programScopedAccess) — the
 * switch is a separate, measured step.
 *   - venture → `venture_own` : `src/lib/ventureScopedAccess.js`.
 * Exported so a guard test can lock this alignment.
 */
export const SHADOW_SCOPE_POLICY = {
  program: "program_managed",
};

/**
 * D-3 — the policies the decision ENFORCES today. They are the same ones the
 * route guards already apply, so adopting this entry point changes no answer:
 *
 *   program → `program_staffed` (the person is staffed on THAT program)
 *   venture → `venture_own`     (the venture is theirs)
 *
 * A project has no declared policy yet; it keeps its membership lookup.
 * The profile-based program perimeter (`program_managed`) is measured in
 * shadow above and switched in Lot 3, once D-4 is exercised.
 */
export const ENFORCED_SCOPE_POLICY = {
  program: "program_staffed",
  venture: "venture_own",
};

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
 * THE SINGLE DECISION ENTRY (Phase 5 — convergence toward one API).
 *
 * One function answers "may this caller do this, to this?": GLOBAL when no
 * `resource` is given, RESOURCE-SCOPED otherwise. It composes the capability
 * primitive (`evaluateAuthorization`, which already carries a `reason`) with the
 * context-assignment step, and always returns
 * `{ allowed, status, errorKey, reason }`.
 *
 * `evaluateScopedAccess` delegates here, so the scoped behavior is unchanged.
 *
 * @param {{module: string, capability: string, minLevel?: number,
 *          resource?: "program"|"project"|"venture"|null,
 *          contextId?: string|number|null}} params
 */
export async function decide({ module, capability, minLevel = 1, resource = null, contextId = null } = {}) {
  // GLOBAL path — nothing to scope to: the capability primitive decides.
  if (!resource) {
    return evaluateAuthorization(module, capability, minLevel);
  }

  // SCOPED path.
  try {
    if (!contextId) {
      // An action that cannot be attributed to a resource cannot be scope-checked.
      return {
        allowed: false,
        status: 403,
        errorKey: "errors.insufficientPermissions",
        reason: "missing_resource",
      };
    }
    const session = await getSession();
    if (!session) {
      return { allowed: false, status: 401, errorKey: "errors.authRequired", reason: "unauthenticated" };
    }

    // Super Admin bypass — existing resolver semantics.
    const authorizationContext = await getAuthorizationContext(session);
    if (authorizationContext?.isSuperAdmin) {
      return { allowed: true, status: 200, errorKey: null, reason: AUTHZ_REASONS.SUPER_ADMIN };
    }

    // CAPABILITY — the resolver decides (eligibility, default/individual
    // access, restrictions). Never bypassed by an assignment. The decision
    // already carries its own `reason` (spec §11).
    const capabilityDecision = await evaluateAuthorization(module, capability, minLevel);
    if (!capabilityDecision.allowed) return capabilityDecision;

    // CONTEXT ASSIGNMENT — the person must belong to THIS resource, under the
    // same rule the route guards apply (D-3: adopt the shape, keep the policy).
    let inScope;
    if (resource === "project") {
      inScope = Boolean(
        await resolveContextAssignment({
          resource,
          contextId,
          userCid: session.cid,
          userEmail: session.email,
        }),
      );
    } else {
      const scopeId = resource === "venture" ? await resolveVentureScopeId(contextId) : contextId;
      inScope = await isWithinScope(ENFORCED_SCOPE_POLICY[resource], session.cid, scopeId, {
        email: session.email,
      });
    }

    // SHADOW — compare the enforced perimeter with the policy that will replace
    // it (the program_manager PROFILE), WITHOUT changing the outcome. Gated by
    // AUTHZ_SHADOW_MODE, inert by default. Ventures already enforce their target
    // policy, so there is nothing left to compare there.
    if (shadowEnabled()) {
      const policy = SHADOW_SCOPE_POLICY[resource];
      if (policy) {
        try {
          const engineAllowed = await isWithinScope(policy, session.cid, contextId, {
            email: session.email,
          });
          shadowCheck({
            legacyAllowed: inScope,
            engineAllowed,
            meta: { resource, contextId, cid: session.cid, policy },
          });
        } catch {
          // The shadow probe never affects the decision.
        }
      }
    }

    if (!inScope) {
      return {
        allowed: false,
        status: 403,
        errorKey: "errors.insufficientPermissions",
        reason: "out_of_scope",
      };
    }
    return { allowed: true, status: 200, errorKey: null, reason: AUTHZ_REASONS.GRANTED };
  } catch (error) {
    console.error("[decide] error:", error?.message);
    return {
      allowed: false,
      status: 500,
      errorKey: "errors.authzSystemFailure",
      reason: "system_failure",
    };
  }
}

/**
 * Route helper — resource-scoped decision, delegating to `decide`.
 * Returns a decision the HTTP boundary turns into a response
 * (`@/server/authz/responses.requireScopedAccess`).
 *
 * @param {{resource: "program"|"project"|"venture", contextId: string|number,
 *          module: string, capability: string, minLevel?: number}} params
 * @returns {Promise<{allowed: boolean, status: number, errorKey: string|null, reason: string}>}
 */
export async function evaluateScopedAccess(params) {
  return decide(params);
}
