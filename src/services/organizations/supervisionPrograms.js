import { hashToken } from "@/lib/token-hashing";
import { getRequestId, newRequestId } from "@/lib/request-context";
import { logger } from "@/lib/logger";
import { withSupervisedProgramRead } from "@/models/organizations/supervisionReads";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["id", "name", "description", "status", "start_date", "end_date", "duration_weeks", "duration_days", "created_at"];
const project = (row) => Object.fromEntries(FIELDS.map((key) => [key, row[key]]));
const failure = (reason, errorKey = "errors.insufficientPermissions") => ({ success: false, reason, errorKey });

async function supervisedRead({ session, organizationId }, read) {
  if (!session?.cid || !session?.token) return failure("no-session", "errors.authRequired");
  if (typeof organizationId !== "string" || !UUID.test(organizationId)) return failure("invalid-query", "errors.invalidRequest");
  return withSupervisedProgramRead({ organizationId, cid: session.cid, token: session.token, tokenHash: hashToken(session.token) }, async (reader) => {
    const mandate = await reader.mandate();
    if (!mandate || mandate.organization_id.toLowerCase() !== organizationId.toLowerCase() || mandate.actor_cid !== session.cid) {
      logger.warn("program_supervision_denied", { organizationId, userId: session.cid });
      return failure("no-supervision");
    }
    const scope = { organizationId: mandate.organization_id, allPrograms: true, programIds: [], deniedProgramIds: [] };
    const result = await read(reader, scope);
    // Even an empty/not-found read is recorded. An audit failure or a mandate
    // expiring during the read prevents data from leaving this transaction.
    const recorded = await reader.recordUsage({ mandateId: mandate.id, action: result.action,
      entityId: result.entityId, count: result.count, requestId: String(getRequestId() || newRequestId()).slice(0, 128) });
    if (!recorded) return failure("supervision-expired");
    return result.body;
  });
}

export async function listSupervisedPrograms({ session, organizationId, page = 1, pageSize = 20, search = "" }) {
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize)
    || pageSize < 1 || pageSize > 50 || typeof search !== "string" || search.length > 100) {
    return failure("invalid-query", "errors.invalidRequest");
  }
  return supervisedRead({ session, organizationId }, async (reader, scope) => {
    const rows = await reader.listPrograms({ scope, search: search.trim(), offset: (page - 1) * pageSize, limit: pageSize + 1 });
    const programs = rows.slice(0, pageSize).map(project);
    return { action: "supervision.programs.list", entityId: organizationId, count: programs.length,
      body: { success: true, programs, pagination: { page, pageSize, hasMore: rows.length > pageSize } } };
  });
}

export async function getSupervisedProgram({ session, organizationId, programId }) {
  if (typeof programId !== "string" || !UUID.test(programId)) return failure("invalid-query", "errors.invalidRequest");
  return supervisedRead({ session, organizationId }, async (reader, scope) => {
    const row = await reader.findProgram({ scope, programId });
    return { action: "supervision.programs.detail", entityId: programId, count: row ? 1 : 0,
      body: row ? { success: true, program: project(row) } : failure("not-found", "errors.notFound") };
  });
}
