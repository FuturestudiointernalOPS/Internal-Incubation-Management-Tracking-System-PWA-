jest.mock("@/lib/db", () => ({ __esModule: true, default: { transaction: jest.fn() } }));
import db from "@/lib/db";
import { withOrganizationProgramRead } from "@/models/organizations/programReads";

let query;
const scope = { organizationId: "org-A", allPrograms: false, programIds: ["program-A"], deniedProgramIds: ["program-denied"] };
beforeEach(() => {
  jest.clearAllMocks();
  query = jest.fn(async () => ({ rows: [] }));
  db.transaction.mockImplementation((cb) => cb(query));
});

test("reads access and programme data in one explicitly read-only consistent snapshot", async () => {
  await withOrganizationProgramRead(async (reader) => {
    await reader.accessSnapshot({ cid: "USR-A", token: "token", tokenHash: "hash" });
    await reader.listPrograms({ scope, search: "", limit: 21, offset: 0 });
  });
  expect(db.transaction).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0][0]).toBe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
  expect(query.mock.calls.slice(1).every(([sql]) => sql.trim().startsWith("SELECT"))).toBe(true);
});

test("fresh session, membership, contract, module and expiring assignments are read together", async () => {
  await withOrganizationProgramRead((reader) => reader.accessSnapshot({ cid: "USR-A", token: "token", tokenHash: "hash" }));
  const [sql, args] = query.mock.calls[1];
  expect(args).toEqual([null, "USR-A", "hash", "token"]);
  for (const fragment of ["s.expires_at > NOW()", "s.active_organization_id", "s.token_hash = ?",
    "m.person_id = s.user_cid", "m.expires_at > NOW()", "m.ended_at IS NULL", "c.signed_at <= NOW()",
    "om.module_key = 'programs'", "a.ends_at > NOW()", "g.revoked_at IS NULL",
    "r.organization_id = a.organization_id", "p.organization_id = o.id", "person.deleted = 0"]) {
    expect(sql).toContain(fragment);
  }
});

test("list binds owner, allowed IDs, denied IDs and literal search before pagination", async () => {
  const search = "%' OR 1=1 --";
  await withOrganizationProgramRead((reader) => reader.listPrograms({ scope, search, limit: 21, offset: 40 }));
  const [sql, args] = query.mock.calls[1];
  expect(sql).toContain("p.organization_id = ?");
  expect(sql).toContain("p.id::text = ANY(?::text[])");
  expect(sql).toContain("AND NOT (p.id::text = ANY(?::text[]))");
  expect(sql).toContain("ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?");
  expect(sql).not.toContain(search);
  expect(sql).not.toContain("SELECT *");
  expect(sql).not.toContain("COALESCE(p.organization_id");
  expect(args).toEqual(["org-A", false, ["program-A"], ["program-denied"], search, 21, 40]);
});

test("detail includes the identical organisation and deny filters, even with a known UUID", async () => {
  await withOrganizationProgramRead((reader) => reader.findProgram({ scope, programId: "known-B" }));
  const [sql, args] = query.mock.calls[1];
  expect(sql).toContain("p.organization_id = ?");
  expect(sql).toContain("AND NOT (p.id::text = ANY(?::text[]))");
  expect(sql).toContain("AND p.id = ? LIMIT 1");
  expect(args).toEqual(["org-A", false, ["program-A"], ["program-denied"], "known-B"]);
});

test("the read-only transaction setup failing prevents all subsequent reads", async () => {
  query.mockRejectedValueOnce(new Error("read-only unavailable"));
  const callback = jest.fn();
  await expect(withOrganizationProgramRead(callback)).rejects.toThrow("read-only unavailable");
  expect(callback).not.toHaveBeenCalled();
});
