jest.mock("@/models/organizations/programManagement", () => ({ withOrganizationProgramManagement: jest.fn() }));
jest.mock("@/lib/token-hashing", () => ({ hashToken: (t) => `hash-${t}` }));
import { withOrganizationProgramManagement } from "@/models/organizations/programManagement";
import { manageOrganizationProgram } from "@/services/organizations/programManagement";
import { evaluateProgramOperationAccess } from "@/services/organizations/programAccess";
const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", programId = "11111111-1111-4111-8111-111111111111";
const cohortId = "22222222-2222-4222-8222-222222222222", enrollmentId = "33333333-3333-4333-8333-333333333333";
const membershipId = "44444444-4444-4444-8444-444444444444";
let snapshot, reader, program, cohort;
const session = { cid: "SYNTH", token: "synthetic-secret", role: "super_admin" };
const call = (action, extra = {}) => manageOrganizationProgram({ session, action, programId, cohortId, enrollmentId, expectedOrganizationId: org, ...extra });
beforeEach(() => {
  jest.clearAllMocks();
  snapshot = { organization_id: org, actor_role: "member", is_platform: false, organization_status: "active", membership_id: membershipId,
    contract_active: true, module_enabled: true, assignments: [{ id: "role", scopeType: "organization", templateScope: "organization", viewLevel: 1,
      capabilities: { create: 1, edit: 1, "cohorts.manage": 1, "enrollments.manage": 1, "sessions.manage": 1 } }], grants: [] };
  program = { id: programId, name: "Synthetic", description: null, start_date: null, end_date: null, duration_weeks: 13, duration_days: 0, status: "active", revision: 2 };
  cohort = { id: cohortId, name: "2027", year: 2027, start_date: null, end_date: null, status: "active", revision: 1 };
  reader = { accessSnapshot: jest.fn(async () => snapshot), program: jest.fn(async () => program),
    createProgram: jest.fn(async () => ({ id: programId })), updateProgram: jest.fn(), revision: jest.fn(async () => 3), audit: jest.fn(),
    cohorts: jest.fn(async () => []), cohort: jest.fn(async () => cohort), createCohort: jest.fn(async () => ({ id: cohortId, revision: 1 })), updateCohort: jest.fn(async () => ({ id: cohortId, revision: 2 })),
    members: jest.fn(async () => []), member: jest.fn(async () => ({ id: membershipId })), enrollments: jest.fn(async () => []),
    enrollment: jest.fn(async () => ({ id: enrollmentId, status: "active", revision: 1 })), enroll: jest.fn(async () => ({ id: enrollmentId, revision: 1 })),
    endEnrollment: jest.fn(async () => ({ id: enrollmentId, revision: 2 })), openSessionCount: jest.fn(async () => 0), sessions: jest.fn(async () => []), session: jest.fn(async () => null), createSession: jest.fn(async () => ({ id: enrollmentId, revision: 1 })), updateSession: jest.fn(async () => ({ id: enrollmentId, revision: 2 })), activeEnrollmentCount: jest.fn(async () => 0), openCohortCount: jest.fn(async () => 0) };
  withOrganizationProgramManagement.mockImplementation(async (_credentials, _write, cb) => cb(reader));
});
test("no authentication or valid organisation precondition means no repository call", async () => {
  expect((await call("create", { session: null, body: { name: "A" } })).reason).toBe("no-session");
  expect((await call("create", { expectedOrganizationId: null, body: { name: "A" } })).reason).toBe("invalid-query");
  expect(withOrganizationProgramManagement).not.toHaveBeenCalled();
});
test.each(["create", "edit", "cohorts.manage", "enrollments.manage"])("a legacy read-only role never acquires %s implicitly", (operation) => {
  snapshot.assignments[0].capabilities = { view: 1 };
  expect(evaluateProgramOperationAccess(snapshot, operation).allowed).toBe(false);
});
test("creation is organisation-wide only, even with a forged global admin role", async () => {
  Object.assign(snapshot.assignments[0], { scopeType: "program", templateScope: "program", scopeId: programId });
  expect((await call("create", { body: { name: "Programme" } })).success).toBe(false);
  expect(reader.createProgram).not.toHaveBeenCalled();
});
test.each(["organization_status", "membership_id", "contract_active", "module_enabled"])("fresh %s failure prevents all writes", async (key) => {
  snapshot[key] = null;
  expect((await call("create", { body: { name: "A" } })).success).toBe(false);
  expect(reader.createProgram).not.toHaveBeenCalled();
});
test("explicit organisation deny overrides a management template", async () => {
  snapshot.grants = [{ subjectType: "membership", subjectId: membershipId, effect: "deny", scopeType: "organization" }];
  expect((await call("create", { body: { name: "A" } })).reason).toBe("explicit-deny");
});
test.each([{ name: "A", organization_id: org }, { name: " " }, { name: "A", start_date: "2027-02-30" }, { name: "A", duration_weeks: "5" }, { name: "A", status: "super_admin" }])("strict input refuses selectors and invalid fields: %j", async (body) => {
  expect((await call("create", { body })).reason).toBe("invalid-query");
  expect(reader.createProgram).not.toHaveBeenCalled();
});
test("create reuses the programme root and audits within the guarded transaction", async () => {
  const result = await call("create", { body: { name: " Example " } });
  expect(result.success).toBe(true);
  expect(reader.createProgram).toHaveBeenCalledWith(org, expect.any(String), expect.objectContaining({ name: "Example", status: "planned" }));
  expect(reader.audit).toHaveBeenCalledWith(org, "member", "program.create", expect.any(String), null, expect.objectContaining({ name: "Example" }));
  expect(reader.accessSnapshot).toHaveBeenCalledTimes(2);
  expect(withOrganizationProgramManagement.mock.calls[0][1]).toBe(true);
});
test("stale organisation refuses before looking up a programme", async () => {
  expect((await call("update", { expectedOrganizationId: cohortId, body: { name: "A", revision: 2 } })).reason).toBe("context-changed");
  expect(reader.program).not.toHaveBeenCalled();
});
test("foreign and missing programme IDs share the same scoped lookup and response", async () => {
  reader.program.mockResolvedValue(null);
  expect((await call("update", { body: { name: "A", revision: 2 } })).reason).toBe("not-found");
  expect(reader.program).toHaveBeenCalledWith(expect.objectContaining({ organizationId: org }), programId);
  expect(reader.updateProgram).not.toHaveBeenCalled();
});
test("stale revisions cannot overwrite recent changes", async () => {
  expect((await call("update", { body: { name: "A", revision: 1 } })).reason).toBe("revision-conflict");
  expect(reader.updateProgram).not.toHaveBeenCalled(); expect(reader.revision).not.toHaveBeenCalled();
});
test("reversed dates after merging a partial edit are refused", async () => {
  program.start_date = "2027-04-01";
  expect((await call("update", { body: { end_date: "2027-03-01", revision: 2 } })).reason).toBe("invalid-query");
  expect(reader.updateProgram).not.toHaveBeenCalled();
});
test("a valid update preserves fields not supplied and increments revision", async () => {
  expect((await call("update", { body: { name: "Changed", revision: 2 } })).result.revision).toBe(3);
  expect(reader.updateProgram).toHaveBeenCalledWith(org, programId, expect.objectContaining({ name: "Changed", duration_weeks: 13 }));
});
test("audit failures propagate so the real repository transaction rolls back", async () => {
  reader.audit.mockRejectedValue(new Error("audit unavailable"));
  await expect(call("update", { body: { name: "A", revision: 2 } })).rejects.toThrow("audit unavailable");
});
test("access expiry after writing throws inside the transaction before success is released", async () => {
  reader.accessSnapshot.mockResolvedValueOnce(snapshot).mockResolvedValueOnce({ ...snapshot, contract_active: false });
  expect((await call("update", { body: { name: "A", revision: 2 } })).reason).toBe("context-changed");
  expect(reader.updateProgram).toHaveBeenCalled();
});
test("a cohort year cannot be changed by PATCH", async () => {
  expect((await call("cohort.update", { body: { year: 2028, revision: 1 } })).reason).toBe("invalid-query");
});
test("a new annual cohort does not update last year's cohort", async () => {
  expect((await call("cohort.create", { body: { year: 2028, name: "Cohort 2028" } })).success).toBe(true);
  expect(reader.createCohort).toHaveBeenCalledWith(org, programId, expect.objectContaining({ year: 2028 }));
  expect(reader.updateCohort).not.toHaveBeenCalled();
});
test("cohort closing requires active enrollments to be ended first", async () => {
  reader.activeEnrollmentCount.mockResolvedValue(2);
  expect((await call("cohort.update", { body: { status: "completed", revision: 1 } })).reason).toBe("record-open");
  expect(reader.updateCohort).not.toHaveBeenCalled();
});
test("programme closing requires open cohorts to be closed first", async () => {
  reader.openCohortCount.mockResolvedValue(1);
  expect((await call("update", { body: { status: "archived", revision: 2 } })).reason).toBe("record-open");
});
test("a foreign or ended membership cannot be enrolled", async () => {
  reader.member.mockResolvedValue(null);
  expect((await call("enroll", { body: { membership_id: membershipId } })).reason).toBe("not-found");
  expect(reader.enroll).not.toHaveBeenCalled();
});
test("programme coordinators cannot browse the organisation directory or enrol new members", async () => {
  Object.assign(snapshot.assignments[0], { scopeType: "program", templateScope: "program", scopeId: programId });
  expect((await call("members")).success).toBe(false);
  expect((await call("enroll", { body: { membership_id: membershipId } })).success).toBe(false);
  expect((await call("enrollment.end", { body: { status: "completed", revision: 1 } })).success).toBe(true);
});
test("read-only programme viewers cannot access member names or enrollment history", async () => {
  snapshot.assignments[0].capabilities = {};
  expect((await call("members")).success).toBe(false); expect((await call("enrollments")).success).toBe(false);
  expect(reader.members).not.toHaveBeenCalled(); expect(reader.enrollments).not.toHaveBeenCalled();
  expect((await call("workspace")).success).toBe(true);
});
test("completed records cannot be rewritten or reactivated but remain readable", async () => {
  cohort.status = "completed";
  expect((await call("enroll", { body: { membership_id: membershipId } })).reason).toBe("record-closed");
  expect((await call("cohort.update", { body: { status: "active", revision: 1 } })).reason).toBe("record-closed");
  expect((await call("enrollments")).success).toBe(true);
});
test("completed enrollments retain their history instead of being reopened", async () => {
  reader.enrollment.mockResolvedValue({ id: enrollmentId, status: "completed", revision: 2 });
  expect((await call("enrollment.end", { body: { status: "withdrawn", revision: 2 } })).reason).toBe("record-closed");
  expect(reader.endEnrollment).not.toHaveBeenCalled();
});
test("bounded pagination uses one extra scoped row and safe allowlisted programme fields", async () => {
  reader.cohorts.mockResolvedValue([cohort, { id: "extra" }]);
  const result = await call("workspace", { pageSize: 1 });
  expect(result.items).toEqual([cohort]); expect(result.pagination.hasMore).toBe(true);
  expect(withOrganizationProgramManagement.mock.calls[0][1]).toBe(false);
});
test("duplicate enrollment conflicts never fall back to legacy membership tables", async () => {
  reader.enroll.mockRejectedValue(Object.assign(new Error("duplicate"), { code: "23505" }));
  expect((await call("enroll", { body: { membership_id: membershipId } })).reason).toBe("revision-conflict");
});
test("session scheduling reuses the existing session store and an explicit cohort link", async () => {
  const result = await call("session.create", { body: { title: "Pitch practice", week_number: 2, start_at: "2027-01-11T08:00:00.000Z" } });
  expect(result.success).toBe(true);
  expect(reader.createSession).toHaveBeenCalledWith(org, programId, cohortId, expect.any(String), expect.objectContaining({ title: "Pitch practice", week_number: 2, duration_minutes: 60 }));
  expect(reader.audit).toHaveBeenCalledWith(org, "member", "session.create", expect.any(String), null, expect.objectContaining({ title: "Pitch practice" }), "session");
});
test.each([{ title: "A", start_at: "2027-02-30T08:00:00.000Z" }, { title: "A", start_at: "2027-01-11T08:00" }, { title: "A", week_number: 0 }, { title: "A", duration_minutes: 0 }, { title: "A", handler_id: "OTHER" }])("invalid or unsupported session fields are refused (%j)", async (body) => {
  expect((await call("session.create", { body })).reason).toBe("invalid-query"); expect(reader.createSession).not.toHaveBeenCalled();
});
test("a session viewer can read bounded schedule metadata but cannot schedule sessions", async () => {
  snapshot.assignments[0].capabilities = {};
  expect((await call("sessions")).success).toBe(true);
  expect((await call("session.create", { body: { title: "A" } })).success).toBe(false);
});
test("session changes require the linked session's current revision", async () => {
  reader.session.mockResolvedValue({ id: enrollmentId, title: "A", description: null, week_number: 1, duration_minutes: 60, status: "planned", start_at: null, revision: 4 });
  expect((await call("session.update", { sessionId: enrollmentId, body: { title: "Changed", revision: 3 } })).reason).toBe("revision-conflict");
  expect(reader.updateSession).not.toHaveBeenCalled();
  expect((await call("session.update", { sessionId: enrollmentId, body: { status: "completed", revision: 4 } })).success).toBe(true);
});
test("closed sessions cannot be rewritten or moved to a different cohort", async () => {
  reader.session.mockResolvedValue({ id: enrollmentId, title: "A", status: "completed", revision: 4 });
  expect((await call("session.update", { sessionId: enrollmentId, body: { title: "Changed", revision: 4 } })).reason).toBe("record-closed");
  expect((await call("session.update", { sessionId: enrollmentId, body: { cohort_id: cohortId, revision: 4 } })).reason).toBe("invalid-query");
});
test("scheduled sessions must close before a cohort can complete", async () => {
  reader.openSessionCount.mockResolvedValue(1);
  expect((await call("cohort.update", { body: { status: "completed", revision: 1 } })).reason).toBe("record-open");
  expect(reader.updateCohort).not.toHaveBeenCalled();
});
