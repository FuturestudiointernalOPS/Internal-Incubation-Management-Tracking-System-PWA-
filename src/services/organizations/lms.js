import { hashToken } from "@/lib/token-hashing";
import { withOrganizationLmsRead } from "@/models/organizations/lmsReads";
import { evaluateLmsReadAccess } from "./programAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refused = (reason, errorKey = "errors.insufficientPermissions") => ({
  success: false,
  reason,
  errorKey,
});

export async function getOrganizationLmsOverview({ session, expectedOrganizationId }) {
  if (!session?.cid || !session?.token) return refused("no-session", "errors.authRequired");
  if (typeof expectedOrganizationId !== "string" || !UUID.test(expectedOrganizationId)) {
    return refused("invalid-query", "errors.invalidRequest");
  }

  return withOrganizationLmsRead(
    { cid: session.cid, token: session.token, tokenHash: hashToken(session.token) },
    async (reader) => {
      const decision = evaluateLmsReadAccess(reader.snapshot);
      if (!decision.allowed) return refused(decision.reason);
      if (decision.scope.organizationId.toLowerCase() !== expectedOrganizationId.toLowerCase()) {
        return refused("context-changed", "errors.organizationContextChanged");
      }

      const catalog = decision.scope.catalog
        ? await reader.listCatalog(decision.scope.organizationId)
        : [];
      const learning = decision.scope.learning
        ? await reader.listOwnLearning(decision.scope.organizationId, session.cid)
        : { enrollments: [], attempts: [], certificates: [] };
      return {
        success: true,
        organizationId: decision.scope.organizationId,
        permissions: { catalog: decision.scope.catalog, learning: decision.scope.learning },
        catalog,
        learning,
      };
    },
  );
}
