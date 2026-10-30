jest.mock("@/lib/token-hashing", () => ({ hashToken: (token) => `hash-${token}` }));
jest.mock("@/models/organizations/ventureReads", () => ({
  withOrganizationVentureRead: jest.fn(),
}));

import { withOrganizationVentureRead } from "@/models/organizations/ventureReads";
import { listOrganizationVentures } from "@/services/organizations/ventures";

const ORGANIZATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const session = { cid: "CLIENT", token: "opaque-token" };
let snapshot;
let reader;

beforeEach(() => {
  jest.clearAllMocks();
  snapshot = {
    organization_id: ORGANIZATION_ID,
    actor_role: "member",
    organization_status: "active",
    is_platform: false,
    membership_id: "membership-a",
    contract_active: true,
    venture_module_enabled: true,
    venture_assignments: [{
      scopeType: "organization",
      scopeId: null,
      templateScope: "organization",
      capabilities: { "assigned.read": 1 },
    }],
    venture_grants: [],
  };
  reader = {
    snapshot,
    listAssignedVentures: jest.fn(async () => [{ id: "venture-1", code: "VNT-1" }]),
  };
  withOrganizationVentureRead.mockImplementation(async (_credentials, callback) => callback(reader));
});

test("requires an authenticated session and a valid active-organisation precondition", async () => {
  expect((await listOrganizationVentures({ session: null, expectedOrganizationId: ORGANIZATION_ID })).reason)
    .toBe("no-session");
  expect((await listOrganizationVentures({ session, expectedOrganizationId: "not-an-id" })).reason)
    .toBe("invalid-query");
  expect(withOrganizationVentureRead).not.toHaveBeenCalled();
});

test("refuses a stale organisation selection before reading venture records", async () => {
  const result = await listOrganizationVentures({
    session,
    expectedOrganizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  });
  expect(result.reason).toBe("context-changed");
  expect(reader.listAssignedVentures).not.toHaveBeenCalled();
});

test("returns only assigned ventures for the active member", async () => {
  const result = await listOrganizationVentures({ session, expectedOrganizationId: ORGANIZATION_ID });
  expect(result).toEqual({
    success: true,
    organizationId: ORGANIZATION_ID,
    ventures: [{ id: "venture-1", code: "VNT-1" }],
    permissions: { readAssigned: true },
  });
  expect(reader.listAssignedVentures).toHaveBeenCalledWith(ORGANIZATION_ID, "CLIENT");
  expect(withOrganizationVentureRead).toHaveBeenCalledWith(
    { cid: "CLIENT", token: "opaque-token", tokenHash: "hash-opaque-token" },
    expect.any(Function),
  );
});
