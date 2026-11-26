const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (callback) => callback(mockQuery)),
  },
}));

import { withOrganizationVentureRead } from "@/models/organizations/ventureReads";

const credentials = { cid: "CLIENT", token: "opaque", tokenHash: "hashed" };
const snapshot = {
  organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql) => {
    if (sql.includes("SELECT o.id AS organization_id")) return { rows: [snapshot] };
    if (sql.includes("FROM ventures venture")) return { rows: [{ id: "venture-1" }] };
    return { rows: [] };
  });
});

test("venture reads require the owner organisation and an active member or staff assignment", async () => {
  await withOrganizationVentureRead(credentials, async (reader) => {
    await reader.listAssignedVentures(snapshot.organization_id, credentials.cid);
  });
  const [sql, args] = mockQuery.mock.calls.find(([statement]) => statement.includes("FROM ventures venture"));
  expect(sql).toContain("venture.owner_organization_id = ?");
  expect(sql).toContain("member.venture_id::text IN (venture.id::text, venture.venture_id)");
  expect(sql).toContain("member.removed_at IS NULL AND member.suspended_at IS NULL");
  expect(sql).toContain("assignment.status = 'active'");
  expect(sql).toContain("assignment.staff_contact_id = ?");
  expect(args).toEqual([
    credentials.cid,
    credentials.cid,
    snapshot.organization_id,
    credentials.cid,
    credentials.cid,
    credentials.cid,
  ]);
});
