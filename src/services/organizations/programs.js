import { hashToken } from "@/lib/token-hashing";
import { withOrganizationProgramRead } from "@/models/organizations/programReads";
import { evaluateProgramReadAccess } from "./programAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["id", "name", "description", "status", "start_date", "end_date",
  "duration_weeks", "duration_days", "created_at"];
const projectProgram = (row) => Object.fromEntries(FIELDS.map((key) => [key, row[key]]));
const refused = (reason, errorKey = "errors.insufficientPermissions") => ({
  success: false, reason, errorKey,
});

// Callers must supply a server-authenticated session, never a request payload.
// Active organisation is reread using its token: session cache / URL / local
// storage / global super_admin role cannot select or broaden the client scope.
async function readAsClient(session, read, expectedOrganizationId) {
  if (!session?.cid || !session?.token) return refused("no-session", "errors.authRequired");
  return withOrganizationProgramRead(async (reader) => {
    const snapshot = await reader.accessSnapshot({
      cid: session.cid, token: session.token, tokenHash: hashToken(session.token),
    });
    const decision = evaluateProgramReadAccess(snapshot);
    if (!decision.allowed) return refused(decision.reason);
    if (expectedOrganizationId && decision.scope.organizationId.toLowerCase() !== expectedOrganizationId.toLowerCase()) {
      return refused("context-changed", "errors.organizationContextChanged");
    }
    return read(reader, decision.scope);
  });
}

export async function listOrganizationPrograms({ session, page = 1, pageSize = 20, search = "", expectedOrganizationId }) {
  if (!Number.isInteger(page) || page < 1 || page > 10000
    || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50
    || typeof search !== "string" || search.length > 100) {
    return refused("invalid-query", "errors.invalidRequest");
  }
  return readAsClient(session, async (reader, scope) => {
    const rows = await reader.listPrograms({
      scope, search: search.trim(), offset: (page - 1) * pageSize, limit: pageSize + 1,
    });
    return { success: true, organizationId: scope.organizationId, programs: rows.slice(0, pageSize).map(projectProgram),
      pagination: { page, pageSize, hasMore: rows.length > pageSize } };
  }, expectedOrganizationId);
}

export async function getOrganizationProgram({ session, programId, expectedOrganizationId }) {
  if (typeof programId !== "string" || !UUID.test(programId)) {
    return refused("invalid-program", "errors.invalidRequest");
  }
  return readAsClient(session, async (reader, scope) => {
    // No unscoped existence probe: foreign and missing IDs are indistinguishable.
    const program = await reader.findProgram({ scope, programId });
    if (!program) return refused("not-found", "errors.notFound");
    return { success: true, organizationId: scope.organizationId, program: projectProgram(program) };
  }, expectedOrganizationId);
}
