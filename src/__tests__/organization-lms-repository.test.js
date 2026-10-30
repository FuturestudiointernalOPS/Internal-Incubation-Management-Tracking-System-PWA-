const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (callback) => callback(mockQuery)),
  },
}));

import { withOrganizationLmsRead } from "@/models/organizations/lmsReads";

const credentials = { cid: "CLIENT", token: "opaque", tokenHash: "hashed" };
const snapshot = {
  organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql) => {
    if (sql.includes("SELECT o.id AS organization_id")) return { rows: [snapshot] };
    if (sql.includes("FROM lms_enrollments enrollment")) {
      return { rows: [{ enrollment_id: "enrollment-1" }] };
    }
    return { rows: [] };
  });
});

test("course catalog queries require ownership or an active, time-valid licence", async () => {
  await withOrganizationLmsRead(credentials, async (reader) => {
    await reader.listCatalog(snapshot.organization_id);
  });
  const [sql, args] = mockQuery.mock.calls.find(([statement]) => statement.includes("FROM lms_courses course"));
  expect(sql).toContain("course.owner_organization_id = ?");
  expect(sql).toContain("license.licensee_organization_id = ?");
  expect(sql).toContain("license.status = 'active'");
  expect(sql).toContain("license.starts_at <= NOW()");
  expect(sql).toContain("license.ends_at > NOW()");
  expect(args).toEqual([snapshot.organization_id, snapshot.organization_id, snapshot.organization_id]);
});

test("learner records bind both identity and active organisation on every read", async () => {
  await withOrganizationLmsRead(credentials, async (reader) => {
    await reader.listOwnLearning(snapshot.organization_id, credentials.cid);
  });
  const statements = mockQuery.mock.calls.filter(([sql]) =>
    sql.includes("FROM lms_enrollments enrollment")
    || sql.includes("FROM lms_assessment_attempts attempt")
    || sql.includes("FROM lms_certificates"),
  );
  expect(statements).toHaveLength(3);
  for (const [sql] of statements) {
    expect(sql).toContain("organization_id = ?");
    expect(sql).toContain("user_cid = ?");
  }
  expect(statements[0][1]).toEqual([snapshot.organization_id, credentials.cid]);
  expect(statements[1][0]).toContain("enrollment.user_cid = attempt.user_cid");
  expect(statements[1][0]).toContain("enrollment.status <> 'suspended'");
  expect(statements[2][1]).toEqual([snapshot.organization_id, credentials.cid]);
});
