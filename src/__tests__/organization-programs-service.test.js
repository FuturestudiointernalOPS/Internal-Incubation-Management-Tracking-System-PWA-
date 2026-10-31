jest.mock("@/lib/token-hashing", () => ({ hashToken: (t) => `hash-${t}` }));
jest.mock("@/models/organizations/programReads", () => ({ withOrganizationProgramRead: jest.fn() }));
import { withOrganizationProgramRead } from "@/models/organizations/programReads";
import { listOrganizationPrograms, getOrganizationProgram } from "@/services/organizations/programs";

const programId = "11111111-1111-4111-8111-111111111111";
const session = { cid: "USR-A", token: "opaque-token", role: "super_admin", activeOrganizationId: "stale-B" };
let access;
let reader;
beforeEach(() => {
  jest.clearAllMocks();
  access = { organization_id: "org-A", actor_role: "member", is_platform: false, organization_status: "active",
    membership_id: "member-A", contract_active: true, module_enabled: true,
    assignments: [{ id: "role-A", viewLevel: 1, scopeType: "program", templateScope: "program", scopeId: programId }], grants: [] };
  reader = { accessSnapshot: jest.fn(async () => access), listPrograms: jest.fn(async () => []), findProgram: jest.fn(async () => null) };
  withOrganizationProgramRead.mockImplementation(async (cb) => cb(reader));
});

test("missing authentication does not read the database", async () => {
  expect(await listOrganizationPrograms({ session: null })).toMatchObject({ success: false, reason: "no-session" });
  expect(withOrganizationProgramRead).not.toHaveBeenCalled();
});

test.each([
  { page: 0 }, { page: 1.5 }, { page: "1" }, { page: 10001 },
  { pageSize: 0 }, { pageSize: 51 }, { search: {} }, { search: "a".repeat(101) },
])("invalid pagination/search is refused before querying (%j)", async (query) => {
  expect(await listOrganizationPrograms({ session, ...query })).toMatchObject({ success: false, reason: "invalid-query" });
  expect(withOrganizationProgramRead).not.toHaveBeenCalled();
});

test("organisation comes from fresh persisted session, ignoring stale cached context and request selectors", async () => {
  await listOrganizationPrograms({ session, organizationId: "forged-B" });
  expect(reader.accessSnapshot).toHaveBeenCalledWith({ cid: session.cid, token: session.token, tokenHash: "hash-opaque-token" });
  expect(reader.listPrograms.mock.calls[0][0].scope.organizationId).toBe("org-A");
});

test("suspension and membership revocation take effect on the next call", async () => {
  expect((await listOrganizationPrograms({ session })).success).toBe(true);
  access.organization_status = "suspended";
  expect((await listOrganizationPrograms({ session })).reason).toBe("organization-inactive");
  access.organization_status = "active";
  access.membership_id = null;
  expect((await listOrganizationPrograms({ session })).reason).toBe("no-membership");
  expect(reader.listPrograms).toHaveBeenCalledTimes(1);
  expect(reader.accessSnapshot).toHaveBeenCalledTimes(3);
});

test.each(["module_enabled", "contract_active"])("rechecks %s without a cached permission decision", async (key) => {
  await listOrganizationPrograms({ session });
  access[key] = false;
  expect((await listOrganizationPrograms({ session })).success).toBe(false);
  expect(reader.listPrograms).toHaveBeenCalledTimes(1);
});

test("pagination uses an extra scoped row, without global counters or private fields", async () => {
  reader.listPrograms.mockResolvedValue([
    { id: programId, name: "Programme A", concept_note: "secret", email: "private@example.invalid", resources: ["private.pdf"] },
    { id: "extra" },
  ]);
  const result = await listOrganizationPrograms({ session, page: 2, pageSize: 1, search: " A " });
  expect(reader.listPrograms).toHaveBeenCalledWith(expect.objectContaining({ offset: 1, limit: 2, search: "A" }));
  expect(result.pagination).toEqual({ page: 2, pageSize: 1, hasMore: true });
  expect(result.programs).toHaveLength(1);
  expect(result.programs[0]).not.toHaveProperty("concept_note");
  expect(result.programs[0]).not.toHaveProperty("email");
  expect(result.programs[0]).not.toHaveProperty("resources");
});

test("invalid programme IDs cannot become SQL inputs", async () => {
  expect((await getOrganizationProgram({ session, programId: "x' OR 1=1" })).reason).toBe("invalid-program");
  expect(withOrganizationProgramRead).not.toHaveBeenCalled();
});

test("foreign and unknown programmes have the same non-disclosing result", async () => {
  const result = await getOrganizationProgram({ session, programId });
  expect(result).toEqual({ success: false, reason: "not-found", errorKey: "errors.notFound" });
  expect(reader.findProgram).toHaveBeenCalledWith({ scope: expect.objectContaining({ organizationId: "org-A" }), programId });
});

test("detail has the same explicit field allowlist as the list", async () => {
  reader.findProgram.mockResolvedValue({ id: programId, name: "Programme A", note_id: "internal", assigned_pm_id: "USR-private" });
  const result = await getOrganizationProgram({ session, programId });
  expect(result.program.name).toBe("Programme A");
  expect(result.program).not.toHaveProperty("note_id");
  expect(result.program).not.toHaveProperty("assigned_pm_id");
});

test("database failure propagates; it never retries against an unscoped legacy list", async () => {
  reader.listPrograms.mockRejectedValue(new Error("offline"));
  await expect(listOrganizationPrograms({ session })).rejects.toThrow("offline");
  expect(reader.listPrograms).toHaveBeenCalledTimes(1);
});

test("a stale-tab precondition cannot select another organisation or trigger programme reads", async () => {
  const result = await listOrganizationPrograms({ session, expectedOrganizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
  expect(result).toMatchObject({ success: false, reason: "context-changed" });
  expect(reader.listPrograms).not.toHaveBeenCalled();
});
