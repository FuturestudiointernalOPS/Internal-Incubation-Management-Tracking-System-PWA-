import { hashToken } from "@/lib/token-hashing";
import { getRequestId, newRequestId } from "@/lib/request-context";
import { invalidateSessionCache } from "@/server/auth/session";
import { withOrganizationSession } from "@/models/organizations/context";
import { evaluateProgramReadAccess, isClientOrganizationActor } from "./programAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (reason, errorKey = "errors.insufficientPermissions") => ({ success: false, reason, errorKey });
const credentials = (session) => ({ cid: session.cid, token: session.token, tokenHash: hashToken(session.token) });
const project = (snapshot) => ({ id: snapshot.organization_id, code: snapshot.code, name: snapshot.name, modules: ["programs"] });

export async function getOrganizationContext({ session }) {
  if (!session?.cid || !session?.token) return fail("no-session", "errors.authRequired");
  return withOrganizationSession(credentials(session), async (reader) => {
    const current = await reader.session();
    if (!current) return fail("no-session", "errors.authRequired");
    if (!isClientOrganizationActor(current.actor_role)) return fail("supervision-required");
    const memberships = await reader.memberships();
    const organizations = [];
    for (const membership of memberships.slice(0, 50)) {
      const snapshot = await reader.access(membership.id);
      if (evaluateProgramReadAccess(snapshot).allowed) organizations.push(project(snapshot));
    }
    const active = await reader.access();
    const decision = evaluateProgramReadAccess(active);
    return { success: true, organizations, truncated: memberships.length > 50,
      // The persisted ID is only a compare-and-swap precondition, never authority.
      activeOrganizationId: current.active_organization_id,
      organization: decision.allowed ? project(active) : null,
      accessIssue: decision.allowed ? null : decision.reason };
  }, { readOnly: true });
}

export async function switchOrganizationContext({ session, organizationId, expectedOrganizationId }) {
  if (!session?.cid || !session?.token) return fail("no-session", "errors.authRequired");
  if (typeof organizationId !== "string" || !UUID.test(organizationId)
    || !(expectedOrganizationId === null || (typeof expectedOrganizationId === "string" && UUID.test(expectedOrganizationId)))) {
    return fail("invalid-query", "errors.invalidRequest");
  }
  const target = organizationId.toLowerCase();
  const expected = expectedOrganizationId?.toLowerCase() || null;
  const result = await withOrganizationSession(credentials(session), async (reader) => {
    const current = await reader.session();
    if (!current) return fail("no-session", "errors.authRequired");
    if (!isClientOrganizationActor(current.actor_role)) return fail("supervision-required");
    if ((current.active_organization_id?.toLowerCase() || null) !== expected) return fail("context-changed", "errors.organizationContextChanged");
    const snapshot = await reader.access(target);
    const decision = evaluateProgramReadAccess(snapshot);
    if (!decision.allowed) return fail(decision.reason);
    if (!(await reader.switchTo(target, expected))) return fail("context-changed", "errors.organizationContextChanged");
    await reader.audit({ organizationId: target, previousOrganizationId: expected,
      actorRole: current.actor_role, requestId: String(getRequestId() || newRequestId()).slice(0, 128) });
    return { success: true, organization: project(snapshot), activeOrganizationId: target };
  });
  if (result.success) invalidateSessionCache(session.token);
  return result;
}
