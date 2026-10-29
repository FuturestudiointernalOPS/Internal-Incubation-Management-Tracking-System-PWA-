import { hashToken } from "@/lib/token-hashing";
import { withOrganizationVentureRead } from "@/models/organizations/ventureReads";
import { evaluateVentureReadAccess } from "./programAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refused = (reason, errorKey = "errors.insufficientPermissions") => ({
  success: false,
  reason,
  errorKey,
});

export async function listOrganizationVentures({ session, expectedOrganizationId }) {
  if (!session?.cid || !session?.token) return refused("no-session", "errors.authRequired");
  if (typeof expectedOrganizationId !== "string" || !UUID.test(expectedOrganizationId)) {
    return refused("invalid-query", "errors.invalidRequest");
  }

  return withOrganizationVentureRead(
    { cid: session.cid, token: session.token, tokenHash: hashToken(session.token) },
    async (reader) => {
      const decision = evaluateVentureReadAccess(reader.snapshot);
      if (!decision.allowed) return refused(decision.reason);
      if (decision.scope.organizationId.toLowerCase() !== expectedOrganizationId.toLowerCase()) {
        return refused("context-changed", "errors.organizationContextChanged");
      }
      const ventures = await reader.listAssignedVentures(decision.scope.organizationId, session.cid);
      return {
        success: true,
        organizationId: decision.scope.organizationId,
        ventures,
        permissions: { readAssigned: true },
      };
    },
  );
}
