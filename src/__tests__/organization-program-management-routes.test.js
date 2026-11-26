jest.mock("@/server/auth/cookies", () => ({ readSessionToken: jest.fn(async () => "synthetic") }));
jest.mock("@/services/organizations/session", () => ({ getOrganizationSession: jest.fn(async () => ({ cid: "SYNTH", token: "synthetic" })) }));
jest.mock("@/services/organizations/programManagement", () => ({ manageOrganizationProgram: jest.fn() }));
jest.mock("@/lib/db", () => ({ initDb: jest.fn(() => { throw new Error("Unexpected runtime schema initialization"); }) }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(() => { throw new Error("Unexpected internal session path"); }) }));
jest.mock("@/lib/logger", () => ({ logger: { error: jest.fn() } }));
import { manageOrganizationProgram } from "@/services/organizations/programManagement";
import { getOrganizationSession } from "@/services/organizations/session";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { organizationProgramManagementRoute } from "@/server/http/organizationProgramManagement";
const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const req = (body, headers = {}, method = "POST") => new Request("https://impact.test/api/org/programs", { method,
  headers: { Origin: "https://impact.test", "Content-Type": "application/json", "X-Organization-Id": org, ...headers },
  ...(method !== "GET" ? { body: JSON.stringify(body) } : {}) });
const context = { params: Promise.resolve({ programId: "programme", cohortId: "cohort", enrollmentId: "enrollment" }) };
beforeEach(() => { jest.clearAllMocks(); getOrganizationSession.mockResolvedValue({ cid: "SYNTH", token: "synthetic" }); manageOrganizationProgram.mockResolvedValue({ success: true, organizationId: org, result: { id: "record" } }); });
test("authenticated client handlers never call initDb or the internal cached session helper", async () => {
  const response = await organizationProgramManagementRoute("create")(req({ name: "Synthetic" }), context);
  expect(response.status).toBe(200); expect(initDb).not.toHaveBeenCalled(); expect(getSession).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toContain("Cookie");
});
test.each(["https://evil.test", "http://impact.test", "null"])("cross-origin %s is refused before the service", async (origin) => {
  expect((await organizationProgramManagementRoute("create")(req({}, { Origin: origin }), context)).status).toBe(403);
  expect(manageOrganizationProgram).not.toHaveBeenCalled();
});
test("missing origin is refused even with same-site cookies", async () => {
  const request = req({}); request.headers.delete("origin");
  expect((await organizationProgramManagementRoute("create")(request, context)).status).toBe(403);
});
test.each(["text/plain", "application/json-malformed"])("invalid content type %s cannot carry a mutation", async (type) => {
  expect((await organizationProgramManagementRoute("create")(req({}, { "Content-Type": type }), context)).status).toBe(400);
});
test("invalid JSON and oversized bodies are refused", async () => {
  const invalid = new Request("https://impact.test/api/org/programs", { method: "POST", headers: { Origin: "https://impact.test", "Content-Type": "application/json" }, body: "{" });
  expect((await organizationProgramManagementRoute("create")(invalid, context)).status).toBe(400);
  expect((await organizationProgramManagementRoute("create")(req({ name: "x".repeat(20001) }), context)).status).toBe(400);
  expect(manageOrganizationProgram).not.toHaveBeenCalled();
});
test("path identifiers and session are forwarded; the header is only a precondition", async () => {
  await organizationProgramManagementRoute("cohort.update")(req({ revision: 1, status: "active" }), context);
  expect(manageOrganizationProgram).toHaveBeenCalledWith(expect.objectContaining({ session: { cid: "SYNTH", token: "synthetic" }, action: "cohort.update", programId: "programme", cohortId: "cohort", expectedOrganizationId: org }));
});
test.each(["revision-conflict", "record-closed", "record-open", "context-changed"])("%s is a private 409", async (reason) => {
  manageOrganizationProgram.mockResolvedValue({ success: false, reason, errorKey: "errors.organizationProgramConflict" });
  expect((await organizationProgramManagementRoute("update")(req({}), context)).status).toBe(409);
});
test("a revoked session is refused before body or service access", async () => {
  getOrganizationSession.mockResolvedValue(null);
  expect((await organizationProgramManagementRoute("create")(req({}), context)).status).toBe(401);
  expect(manageOrganizationProgram).not.toHaveBeenCalled();
});
test("exceptions reveal no SQL or credentials", async () => {
  manageOrganizationProgram.mockRejectedValue(new Error("SELECT secret synthetic-token"));
  const response = await organizationProgramManagementRoute("create")(req({}), context);
  expect(response.status).toBe(500); expect(await response.json()).toEqual({ success: false, error: "errors.somethingWrong" });
});
