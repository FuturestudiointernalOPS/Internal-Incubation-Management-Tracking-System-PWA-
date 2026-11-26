jest.mock("@/lib/token-hashing", () => ({ hashToken: (token) => `hash-${token}` }));
jest.mock("@/lib/request-context", () => ({ getRequestId: () => "request-test", newRequestId: () => "new-request" }));
jest.mock("@/lib/logger", () => ({ logger: { warn: jest.fn() } }));
jest.mock("@/models/organizations/supervisionReads", () => ({ withSupervisedProgramRead: jest.fn() }));
import { withSupervisedProgramRead } from "@/models/organizations/supervisionReads";
import { listSupervisedPrograms, getSupervisedProgram } from "@/services/organizations/supervisionPrograms";
import { organizationProgramResponse, privateOrganizationHandler } from "@/server/http/organizationPrograms";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const programId = "44444444-4444-4444-8444-444444444444";
const session = { cid: "STAFF", token: "opaque", role: "super_admin" };
let reader;
beforeEach(() => {
  jest.clearAllMocks();
  reader = {
    mandate: jest.fn(async () => ({ id: "mandate", organization_id: organizationId, actor_cid: session.cid })),
    listPrograms: jest.fn(async () => []), findProgram: jest.fn(async () => null),
    recordUsage: jest.fn(async () => true),
  };
  withSupervisedProgramRead.mockImplementation(async (_credentials, callback) => callback(reader));
});

test("missing authentication never reaches the repository", async () => {
  expect((await listSupervisedPrograms({ organizationId })).reason).toBe("no-session");
  expect(withSupervisedProgramRead).not.toHaveBeenCalled();
});

test.each([{ page: 0 }, { page: "1" }, { pageSize: 51 }, { search: {} }, { organizationId: "injected" }])(
  "invalid selectors are rejected before a database call: %j", async (query) => {
    expect((await listSupervisedPrograms({ session, organizationId, ...query })).reason).toBe("invalid-query");
    expect(withSupervisedProgramRead).not.toHaveBeenCalled();
  },
);

test.each([null, { organization_id: "foreign", actor_cid: session.cid }, { organization_id: organizationId, actor_cid: "other" }])(
  "a cached super-admin role cannot replace a matching fresh mandate: %j", async (mandate) => {
    reader.mandate.mockResolvedValue(mandate);
    expect((await listSupervisedPrograms({ session, organizationId })).reason).toBe("no-supervision");
    expect(reader.listPrograms).not.toHaveBeenCalled();
  },
);

test("only scoped, projected data is returned after the mandatory audit", async () => {
  reader.listPrograms.mockResolvedValue([{ id: programId, name: "Synthetic", private_note: "secret" }, { id: "extra" }]);
  const result = await listSupervisedPrograms({ session, organizationId, page: 2, pageSize: 1, search: " A " });
  expect(withSupervisedProgramRead).toHaveBeenCalledWith({ organizationId, cid: "STAFF", token: "opaque", tokenHash: "hash-opaque" }, expect.any(Function));
  expect(reader.listPrograms).toHaveBeenCalledWith({ scope: { organizationId, allPrograms: true, programIds: [], deniedProgramIds: [] }, offset: 1, limit: 2, search: "A" });
  expect(result.pagination).toEqual({ page: 2, pageSize: 1, hasMore: true });
  expect(result.programs[0]).not.toHaveProperty("private_note");
  expect(reader.recordUsage).toHaveBeenCalledWith({ mandateId: "mandate", action: "supervision.programs.list", entityId: organizationId, count: 1, requestId: "request-test" });
  expect(reader.recordUsage.mock.invocationCallOrder[0]).toBeGreaterThan(reader.listPrograms.mock.invocationCallOrder[0]);
});

test("expiry at audit time discards already-read data", async () => {
  reader.listPrograms.mockResolvedValue([{ id: programId, name: "Synthetic" }]);
  reader.recordUsage.mockResolvedValue(false);
  const result = await listSupervisedPrograms({ session, organizationId });
  expect(result).toMatchObject({ success: false, reason: "supervision-expired" });
  expect(result).not.toHaveProperty("programs");
});

test("audit failure cannot become a successful response", async () => {
  reader.recordUsage.mockRejectedValue(new Error("audit unavailable"));
  await expect(listSupervisedPrograms({ session, organizationId })).rejects.toThrow("audit unavailable");
});

test("unknown or foreign details return the same audited non-disclosing result", async () => {
  expect(await getSupervisedProgram({ session, organizationId, programId })).toMatchObject({ success: false, reason: "not-found" });
  expect(reader.recordUsage).toHaveBeenCalledWith(expect.objectContaining({ action: "supervision.programs.detail", count: 0, entityId: programId }));
});

test("revocation is checked again on the next request", async () => {
  expect((await listSupervisedPrograms({ session, organizationId })).success).toBe(true);
  reader.mandate.mockResolvedValue(null);
  expect((await listSupervisedPrograms({ session, organizationId })).success).toBe(false);
  expect(reader.listPrograms).toHaveBeenCalledTimes(1);
});

test.each([["no-session", 401], ["invalid-query", 400], ["not-found", 404], ["no-supervision", 403], ["supervision-expired", 403]])(
  "private responses preserve denial status %s", async (reason, status) => {
    const handler = privateOrganizationHandler(async () => organizationProgramResponse({ success: false, reason, errorKey: "errors.insufficientPermissions" }));
    const response = await handler();
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toContain("Cookie");
  },
);
