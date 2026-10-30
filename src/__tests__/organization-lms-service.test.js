jest.mock("@/lib/token-hashing", () => ({ hashToken: (token) => `hash-${token}` }));
jest.mock("@/models/organizations/lmsReads", () => ({
  withOrganizationLmsRead: jest.fn(),
}));

import { withOrganizationLmsRead } from "@/models/organizations/lmsReads";
import { getOrganizationLmsOverview } from "@/services/organizations/lms";

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
    lms_module_enabled: true,
    lms_assignments: [{
      scopeType: "organization",
      scopeId: null,
      templateScope: "organization",
      capabilities: { "learning.read": 1 },
    }],
    lms_grants: [],
  };
  reader = {
    snapshot,
    listCatalog: jest.fn(async () => [{ id: "course-1" }]),
    listOwnLearning: jest.fn(async () => ({ enrollments: [{ id: "enrollment-1" }], attempts: [], certificates: [] })),
  };
  withOrganizationLmsRead.mockImplementation(async (_credentials, callback) => callback(reader));
});

test("requires a server session and a valid active-organisation precondition", async () => {
  expect((await getOrganizationLmsOverview({ session: null, expectedOrganizationId: ORGANIZATION_ID })).reason)
    .toBe("no-session");
  expect((await getOrganizationLmsOverview({ session, expectedOrganizationId: "not-an-id" })).reason)
    .toBe("invalid-query");
  expect(withOrganizationLmsRead).not.toHaveBeenCalled();
});

test("refuses a stale organisation selection before reading LMS records", async () => {
  const result = await getOrganizationLmsOverview({
    session,
    expectedOrganizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  });
  expect(result.reason).toBe("context-changed");
  expect(reader.listCatalog).not.toHaveBeenCalled();
  expect(reader.listOwnLearning).not.toHaveBeenCalled();
});

test("learner access returns only own learning and does not query the catalogue", async () => {
  const result = await getOrganizationLmsOverview({ session, expectedOrganizationId: ORGANIZATION_ID });
  expect(result).toMatchObject({
    success: true,
    organizationId: ORGANIZATION_ID,
    permissions: { catalog: false, learning: true },
    catalog: [],
    learning: { enrollments: [{ id: "enrollment-1" }], attempts: [], certificates: [] },
  });
  expect(reader.listCatalog).not.toHaveBeenCalled();
  expect(reader.listOwnLearning).toHaveBeenCalledWith(ORGANIZATION_ID, "CLIENT");
  expect(withOrganizationLmsRead).toHaveBeenCalledWith(
    { cid: "CLIENT", token: "opaque-token", tokenHash: "hash-opaque-token" },
    expect.any(Function),
  );
});

test("a content manager gets the organization catalogue without learner records", async () => {
  snapshot.lms_assignments = [{
    scopeType: "organization",
    scopeId: null,
    templateScope: "organization",
    capabilities: { "catalog.read": 1 },
  }];
  const result = await getOrganizationLmsOverview({ session, expectedOrganizationId: ORGANIZATION_ID });
  expect(result.permissions).toEqual({ catalog: true, learning: false });
  expect(result.catalog).toEqual([{ id: "course-1" }]);
  expect(result.learning).toEqual({ enrollments: [], attempts: [], certificates: [] });
  expect(reader.listCatalog).toHaveBeenCalledWith(ORGANIZATION_ID);
  expect(reader.listOwnLearning).not.toHaveBeenCalled();
});
