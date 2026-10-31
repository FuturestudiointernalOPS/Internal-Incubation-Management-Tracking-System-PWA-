import { randomUUID } from "node:crypto";
import { hashToken } from "@/lib/token-hashing";
import { getRequestId, newRequestId } from "@/lib/request-context";
import { withOrganizationProgramManagement } from "@/models/organizations/programManagement";
import { evaluateProgramReadAccess, evaluateProgramOperationAccess } from "./programAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["name", "description", "status", "start_date", "end_date", "duration_weeks", "duration_days"];
const OPERATIONS = { create: "create", update: "edit", "cohort.create": "cohorts.manage", "cohort.update": "cohorts.manage",
  "session.create": "sessions.manage", "session.update": "sessions.manage", sessions: null, members: "enrollments.manage", enrollments: "enrollments.manage", enroll: "enrollments.manage", "enrollment.end": "enrollments.manage", workspace: null };
const fail = (reason, errorKey = "errors.insufficientPermissions") => ({ success: false, reason, errorKey });
const conflict = () => fail("revision-conflict", "errors.organizationProgramConflict");
const closed = () => fail("record-closed", "errors.organizationProgramClosed");
const isUuid = (v) => typeof v === "string" && UUID.test(v);
const permits = (scope, id) => !scope.deniedProgramIds.includes(id)
  && (scope.allPrograms || scope.programIds.includes(id));
const date = (v) => v instanceof Date ? v.toISOString().slice(0, 10) : v;
const validDate = (v) => v === null || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const validDates = (v) => validDate(v.start_date) && validDate(v.end_date)
  && (!v.start_date || !v.end_date || v.start_date <= v.end_date);
const label = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 160;
const terminal = (v) => ["completed", "archived"].includes(String(v).toLowerCase());
function validBody(action, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const sessionAction = action.startsWith("session.");
  const keys = sessionAction ? ["title", "description", "week_number", "start_at", "duration_minutes", ...(action === "session.update" ? ["revision", "status"] : [])] : action === "create" ? FIELDS : action === "update" ? [...FIELDS, "revision"]
    : action === "cohort.create" ? ["name", "year", "start_date", "end_date"]
      : action === "cohort.update" ? ["name", "status", "start_date", "end_date", "revision"]
        : action === "enroll" ? ["membership_id"] : ["status", "revision"];
  if (Object.keys(body).some((key) => !keys.includes(key)) || !Object.keys(body).length) return false;
  if (["update", "cohort.update", "enrollment.end", "session.update"].includes(action)
    && (!Number.isInteger(body.revision) || body.revision < 0 || Object.keys(body).length < 2)) return false;
  if (action === "enroll") return isUuid(body.membership_id);
  if (action === "enrollment.end") return ["completed", "withdrawn"].includes(body.status);
  if (!sessionAction && (action.endsWith("create") || "name" in body) && !label(body.name)) return false;
  if (action === "cohort.create" && (!Number.isInteger(body.year) || body.year < 2000 || body.year > 2200)) return false;
  if (sessionAction && ((action === "session.create" || "title" in body) && !label(body.title))) return false;
  if ("week_number" in body && (!Number.isInteger(body.week_number) || body.week_number < 1 || body.week_number > 520)) return false;
  if ("duration_minutes" in body && (!Number.isInteger(body.duration_minutes) || body.duration_minutes < 1 || body.duration_minutes > 1440)) return false;
  if ("start_at" in body && body.start_at !== null && (typeof body.start_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.start_at) || Number.isNaN(Date.parse(body.start_at)) || new Date(body.start_at).toISOString() !== body.start_at)) return false;
  if ("description" in body && body.description !== null && (typeof body.description !== "string" || body.description.length > 10000)) return false;
  if ("status" in body && !["planned", "active", "completed", "archived"].includes(body.status)) return false;
  if ("duration_weeks" in body && (!Number.isInteger(body.duration_weeks) || body.duration_weeks < 1 || body.duration_weeks > 520)) return false;
  if ("duration_days" in body && (!Number.isInteger(body.duration_days) || body.duration_days < 0 || body.duration_days > 3650)) return false;
  return ["start_date", "end_date"].every((key) => !(key in body) || validDate(body[key]));
}
const fields = (old, body, names) => Object.fromEntries(names.map((key) => [key, date(key in body ? body[key] : old[key])]));
const pageRows = (rows, page, pageSize) => ({ items: rows.slice(0, pageSize), pagination: { page, pageSize, hasMore: rows.length > pageSize } });
class ChangedAccess extends Error {}

export async function manageOrganizationProgram({ session, action, programId, cohortId, enrollmentId, sessionId, body,
  expectedOrganizationId, page = 1, pageSize = 20, search = "" }) {
  if (!session?.cid || !session?.token) return fail("no-session", "errors.authRequired");
  if (!Object.hasOwn(OPERATIONS, action) || !isUuid(expectedOrganizationId)
    || (action !== "create" && !isUuid(programId))
    || (["cohort.update", "enroll", "enrollments", "enrollment.end", "sessions", "session.create", "session.update"].includes(action) && !isUuid(cohortId))
    || (action === "enrollment.end" && !isUuid(enrollmentId)) || (action === "session.update" && !isUuid(sessionId))
    || !Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50
    || typeof search !== "string" || search.length > 100) return fail("invalid-query", "errors.invalidRequest");
  [programId, cohortId, enrollmentId, sessionId] = [programId, cohortId, enrollmentId, sessionId].map((id) => typeof id === "string" ? id.toLowerCase() : undefined);
  const write = !["workspace", "members", "enrollments", "sessions"].includes(action);
  if (write && !validBody(action, body)) return fail("invalid-query", "errors.invalidRequest");
  const operation = OPERATIONS[action];
  const credentials = { cid: session.cid, token: session.token, tokenHash: hashToken(session.token), requestId: String(getRequestId() || newRequestId()).slice(0, 128) };
  const decide = (snapshot) => operation ? evaluateProgramOperationAccess(snapshot, operation) : evaluateProgramReadAccess(snapshot);
  try {
    return await withOrganizationProgramManagement(credentials, write, async (reader) => {
      const snapshot = await reader.accessSnapshot();
      const decision = decide(snapshot);
      if (!decision.allowed) return fail(decision.reason);
      const scope = decision.scope, organizationId = scope.organizationId;
      if (["members", "enroll"].includes(action) && !scope.allPrograms) return fail("capability-missing");
      if (organizationId.toLowerCase() !== expectedOrganizationId.toLowerCase()) return fail("context-changed", "errors.organizationContextChanged");
      const program = action === "create" ? null : await reader.program(scope, programId);
      if (action !== "create" && !program) return fail("not-found", "errors.notFound");
      if (write && program && terminal(program.status)) return closed();
      let result;
      if (action === "workspace") {
        const permissions = {};
        for (const op of ["edit", "cohorts.manage", "enrollments.manage", "sessions.manage"]) {
          const d = evaluateProgramOperationAccess(snapshot, op);
          permissions[op] = d.allowed && permits(d.scope, programId);
        }
        const enrollmentScope = evaluateProgramOperationAccess(snapshot, "enrollments.manage");
        permissions.enroll = enrollmentScope.allowed && enrollmentScope.scope.allPrograms;
        return { success: true, organizationId, program, permissions,
          ...pageRows(await reader.cohorts(organizationId, programId, pageSize + 1, (page - 1) * pageSize), page, pageSize) };
      }
      if (action === "members") return { success: true, organizationId,
        ...pageRows(await reader.members(organizationId, search.trim(), pageSize + 1, (page - 1) * pageSize), page, pageSize) };
      if (action === "create" || action === "update") {
        if (program && body.revision !== program.revision) return conflict();
        const values = fields(program || { description: null, status: "planned", start_date: null, end_date: null, duration_weeks: 13, duration_days: 0 }, body, FIELDS);
        values.name = values.name.trim();
        if (!validDates(values)) return fail("invalid-query", "errors.invalidRequest");
        if (program && terminal(values.status) && await reader.openCohortCount(organizationId, programId)) {
          return fail("record-open", "errors.organizationProgramOpenEnrollments");
        }
        const id = program?.id || randomUUID();
        if (program) await reader.updateProgram(organizationId, id, values);
        else await reader.createProgram(organizationId, id, values);
        const revision = await reader.revision(organizationId, id);
        result = { id, revision };
        await reader.audit(organizationId, snapshot.actor_role, `program.${action}`, id, program, { ...values, revision });
      } else if (action === "cohort.create") {
        const values = { ...body, name: body.name.trim(), start_date: body.start_date ?? null, end_date: body.end_date ?? null };
        if (!validDates(values)) return fail("invalid-query", "errors.invalidRequest");
        result = await reader.createCohort(organizationId, programId, values);
      } else {
        const cohort = await reader.cohort(organizationId, programId, cohortId);
        if (!cohort) return fail("not-found", "errors.notFound");
        if (action === "sessions") return { success: true, organizationId, ...pageRows(await reader.sessions(organizationId, programId, cohortId, pageSize + 1, (page - 1) * pageSize), page, pageSize) };
        if (action === "enrollments") return { success: true, organizationId,
          ...pageRows(await reader.enrollments(organizationId, programId, cohortId, pageSize + 1, (page - 1) * pageSize), page, pageSize) };
        if (terminal(cohort.status)) return closed();
        if (action.startsWith("session.")) {
          const previous = action === "session.update" ? await reader.session(organizationId, programId, cohortId, sessionId) : null;
          if (action === "session.update" && !previous) return fail("not-found", "errors.notFound");
          if (previous && terminal(previous.status)) return closed();
          if (previous && previous.revision !== body.revision) return conflict();
          const values = fields(previous || { description: null, week_number: 1, start_at: null, duration_minutes: 60, status: "planned" }, body, ["title", "description", "week_number", "start_at", "duration_minutes", "status"]);
          // Session timestamps keep their full UTC precision (programme dates do not).
          values.start_at = "start_at" in body ? body.start_at : previous?.start_at instanceof Date ? previous.start_at.toISOString() : previous?.start_at ?? null;
          values.title = values.title.trim();
          const id = previous?.id || randomUUID();
          result = previous ? await reader.updateSession(organizationId, programId, cohortId, id, values) : await reader.createSession(organizationId, programId, cohortId, id, values);
          await reader.audit(organizationId, snapshot.actor_role, action, id, previous, values, "session");
        } else if (action === "cohort.update") {
          if (body.revision !== cohort.revision) return conflict();
          const values = fields(cohort, body, ["name", "status", "start_date", "end_date"]);
          values.name = values.name.trim();
          if (!validDates(values)) return fail("invalid-query", "errors.invalidRequest");
          if (terminal(values.status) && (await reader.activeEnrollmentCount(organizationId, programId, cohortId) || await reader.openSessionCount(organizationId, programId, cohortId))) {
            return fail("record-open", "errors.organizationProgramOpenEnrollments");
          }
          result = await reader.updateCohort(organizationId, programId, cohortId, values);
        } else if (action === "enroll") {
          if (!(await reader.member(organizationId, body.membership_id))) return fail("not-found", "errors.notFound");
          result = await reader.enroll(organizationId, programId, cohortId, body.membership_id);
        } else {
          const enrollment = await reader.enrollment(organizationId, programId, cohortId, enrollmentId);
          if (!enrollment) return fail("not-found", "errors.notFound");
          if (enrollment.status !== "active") return closed();
          if (body.revision !== enrollment.revision) return conflict();
          result = await reader.endEnrollment(organizationId, programId, cohortId, enrollmentId, body.status);
        }
      }
      // Recheck time-bound access before releasing a committed result. Throwing
      // rolls back BOTH business writes and trigger audit if access changed.
      const final = decide(await reader.accessSnapshot());
      if (!final.allowed || (action === "enroll" && !final.scope.allPrograms) || final.scope.organizationId !== organizationId
        || (action !== "create" && !permits(final.scope, programId))) throw new ChangedAccess();
      return { success: true, organizationId, result };
    });
  } catch (error) {
    if (error instanceof ChangedAccess) return fail("context-changed", "errors.organizationContextChanged");
    if (error.code === "23505") return conflict();
    throw error;
  }
}
