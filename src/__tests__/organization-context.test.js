jest.mock("@/lib/token-hashing", () => ({ hashToken: (token) => `hash-${token}` }));
jest.mock("@/models/organizations/context", () => ({ withOrganizationSession: jest.fn() }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(), invalidateSessionCache: jest.fn() }));
jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => {}) }));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/lib/logger", () => ({ logger: { debug: jest.fn(), error: jest.fn() } }));
import { withOrganizationSession } from "@/models/organizations/context";
import { getSession, invalidateSessionCache } from "@/server/auth/session";
import { getOrganizationContext, switchOrganizationContext } from "@/services/organizations/context";
import { GET, POST } from "@/app/api/org/context/route";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const session = { cid: "CLIENT", token: "opaque", role: "super_admin" };
let reader, active, snapshot;
beforeEach(() => {
  jest.clearAllMocks(); active = A;
  snapshot = { organization_id: B, code: "beta", name: "Synthetic Beta", actor_role: "member", is_platform: false,
    organization_status: "active", membership_id: "member", contract_active: true, module_enabled: true,
    assignments: [{ id: "role", scopeType: "organization", templateScope: "organization", viewLevel: 1 }], grants: [] };
  reader = { session: jest.fn(async () => ({ active_organization_id: active, actor_role: "member" })),
    memberships: jest.fn(async () => [{ id: B }]), access: jest.fn(async () => snapshot),
    switchTo: jest.fn(async () => true), audit: jest.fn(async () => {}) };
  withOrganizationSession.mockImplementation(async (_credentials, callback) => callback(reader));
  getSession.mockResolvedValue(session);
});
const change = (overrides = {}) => switchOrganizationContext({ session, organizationId: B, expectedOrganizationId: A, ...overrides });
const request = (body, origin = "http://localhost") => new Request("http://localhost/api/org/context", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("missing authentication never opens a context transaction", async () => {
  expect((await change({ session: null })).reason).toBe("no-session");
  expect(withOrganizationSession).not.toHaveBeenCalled();
});
test.each([{ organizationId: "forged" }, { expectedOrganizationId: undefined }, { expectedOrganizationId: "bad" }])("invalid selection is refused: %j", async (input) => {
  expect((await change(input)).reason).toBe("invalid-query"); expect(withOrganizationSession).not.toHaveBeenCalled();
});
test("context selection authenticates the current token, audits, then evicts only its cached session", async () => {
  expect((await change()).organization.id).toBe(B);
  expect(reader.switchTo).toHaveBeenCalledWith(B, A);
  expect(reader.audit).toHaveBeenCalledWith(expect.objectContaining({ organizationId: B, previousOrganizationId: A, actorRole: "member" }));
  expect(invalidateSessionCache).toHaveBeenCalledWith("opaque");
  expect(withOrganizationSession.mock.calls[0][0]).toEqual({ cid: "CLIENT", token: "opaque", tokenHash: "hash-opaque" });
});
test("a stale tab cannot overwrite another organisation selection", async () => {
  active = B; expect((await change()).reason).toBe("context-changed"); expect(reader.switchTo).not.toHaveBeenCalled();
});
test.each(["suspended", "archived", "draft"])("%s organisations cannot be selected", async (status) => {
  snapshot.organization_status = status; expect((await change()).success).toBe(false); expect(reader.switchTo).not.toHaveBeenCalled();
});
test.each(["membership_id", "contract_active", "module_enabled"])("fresh %s failure prevents the switch", async (key) => {
  snapshot[key] = null; expect((await change()).success).toBe(false); expect(reader.switchTo).not.toHaveBeenCalled();
});
test("internal staff cannot borrow a client membership to avoid supervision", async () => {
  reader.session.mockResolvedValue({ active_organization_id: A, actor_role: "staff" });
  expect((await change()).reason).toBe("supervision-required"); expect(reader.access).not.toHaveBeenCalled();
});
test("audit failure propagates and prevents cache invalidation", async () => {
  reader.audit.mockRejectedValue(new Error("audit unavailable")); await expect(change()).rejects.toThrow("audit unavailable"); expect(invalidateSessionCache).not.toHaveBeenCalled();
});
test("GET uses a read-only transaction and exposes no token", async () => {
  const result = await getOrganizationContext({ session });
  expect(result.organizations).toEqual([{ id: B, code: "beta", name: "Synthetic Beta", modules: ["programs"] }]);
  expect(JSON.stringify(result)).not.toContain("opaque"); expect(withOrganizationSession.mock.calls[0][2]).toEqual({ readOnly: true });
});
test("GET does not mutate the selected organisation", async () => {
  const response = await GET(new Request("http://localhost/api/org/context"));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(reader.switchTo).not.toHaveBeenCalled();
});
test.each(["http://evil.test", "https://localhost", "null"])("cross-origin %s cannot change context", async (origin) => {
  expect((await POST(request({ organization_id: B, expected_organization_id: A }, origin))).status).toBe(403); expect(reader.switchTo).not.toHaveBeenCalled();
});
test("POST returns the server-selected context, with private response headers", async () => {
  const response = await POST(request({ organization_id: B, expected_organization_id: A }));
  expect(response.status).toBe(200); expect((await response.json()).organization.id).toBe(B); expect(response.headers.get("cache-control")).toBe("private, no-store");
});
test("POST returns 409 for a stale tab", async () => {
  active = B; expect((await POST(request({ organization_id: B, expected_organization_id: A }))).status).toBe(409);
});
