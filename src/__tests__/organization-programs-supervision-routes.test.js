jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => {}) }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/lib/logger", () => ({ logger: { debug: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock("@/services/organizations/supervisionPrograms", () => ({ listSupervisedPrograms: jest.fn(), getSupervisedProgram: jest.fn() }));
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireAuth } from "@/server/auth/guards";
import { listSupervisedPrograms, getSupervisedProgram } from "@/services/organizations/supervisionPrograms";
import { GET as list } from "@/app/api/platform/organizations/[organizationId]/programs/route";
import { GET as detail } from "@/app/api/platform/organizations/[organizationId]/programs/[programId]/route";

const session = { cid: "staff", token: "server-token" };
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const programId = "44444444-4444-4444-8444-444444444444";
function request(query = "") { return new Request(`http://localhost/api/platform/organizations/${organizationId}/programs${query}`); }
const context = () => ({ params: Promise.resolve({ organizationId, programId }) });
beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue(session);
  requireAuth.mockResolvedValue(null);
  listSupervisedPrograms.mockResolvedValue({ success: true, programs: [] });
  getSupervisedProgram.mockResolvedValue({ success: true, program: { id: programId } });
});

test("list uses the authenticated identity and path organisation, ignoring query spoofing", async () => {
  const response = await list(request("?page=2&pageSize=3&search=test&organizationId=forged"), context());
  expect(response.status).toBe(200);
  expect(listSupervisedPrograms).toHaveBeenCalledWith({ session, organizationId, page: 2, pageSize: 3, search: "test" });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

test("detail forwards both path selectors to the scoped service", async () => {
  const response = await detail(request(), context());
  expect(response.status).toBe(200);
  expect(getSupervisedProgram).toHaveBeenCalledWith({ session, organizationId, programId });
});

test("unauthenticated replies are private and do not reach the service", async () => {
  getSession.mockResolvedValue(null);
  requireAuth.mockResolvedValue(NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 }));
  const response = await list(request(), context());
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(listSupervisedPrograms).not.toHaveBeenCalled();
});

test.each([["invalid-query", 400], ["no-supervision", 403], ["not-found", 404]])(
  "service refusal %s survives the HTTP boundary", async (reason, status) => {
    getSupervisedProgram.mockResolvedValue({ success: false, reason, errorKey: "errors.insufficientPermissions" });
    const response = await detail(request(), context());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ success: false, error: "errors.insufficientPermissions" });
  },
);

test("an audit/database exception returns a private generic failure, without private diagnostics", async () => {
  listSupervisedPrograms.mockRejectedValue(new Error("private SQL detail"));
  const response = await list(request(), context());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: "errors.somethingWrong" });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
