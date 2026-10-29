jest.mock("@/lib/db", () => ({ __esModule: true, default: { transaction: jest.fn() } }));
import db from "@/lib/db";
import { withOrganizationProgramManagement } from "@/models/organizations/programManagement";
import { findOrganizationSession } from "@/models/organizations/session";
const credentials = { cid: "SYNTH", token: "token", tokenHash: "hash", requestId: "request" };
const scope = { organizationId: "org-A", allPrograms: false, programIds: ["P1"], deniedProgramIds: ["P2"] };
let query;
beforeEach(() => { jest.clearAllMocks(); query = jest.fn(async () => ({ rows: [{ id: "row", revision: 2, count: "1" }] })); db.transaction.mockImplementation((cb) => cb(query)); });
test("authentication is a strictly read-only lookup without schema or token repair", async () => {
  await findOrganizationSession("token", "hash");
  expect(query.mock.calls[0][0]).toBe("SET TRANSACTION READ ONLY");
  const [sql, args] = query.mock.calls[2];
  expect(args).toEqual(["hash", "token"]); expect(sql).toContain("clock_timestamp()"); expect(sql).toContain("c.deleted=0");
  expect(query.mock.calls.every(([statement]) => /^(SET|SELECT)/.test(statement))).toBe(true);
});
test("management locks the credential-bound session before any snapshot or business write", async () => {
  await withOrganizationProgramManagement(credentials, true, (r) => r.accessSnapshot());
  expect(query.mock.calls[0][0]).toBe("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
  expect(query.mock.calls[3][0]).toContain("FOR UPDATE"); expect(query.mock.calls[3][1]).toEqual(["SYNTH", "hash", "token"]);
  expect(query.mock.calls[5][0]).toContain("s.active_organization_id");
  expect(query.mock.calls[5][0]).toContain("clock_timestamp()");
});
test("programme revision is read in a new statement after acquiring the parent lock", async () => {
  await withOrganizationProgramManagement(credentials, true, (r) => r.program(scope, "P1"));
  const calls = query.mock.calls.filter(([sql]) => sql.includes("FROM v2_programs p"));
  expect(calls).toHaveLength(2); expect(calls[0][0]).toContain("FOR UPDATE OF p");
  expect(calls[1][0]).toContain("COALESCE(r.revision,0)"); expect(calls[1][0]).not.toContain("FOR UPDATE");
  for (const [sql, args] of calls) { expect(sql).toContain("p.organization_id = ?"); expect(args).toEqual(["org-A", false, ["P1"], ["P2"], "P1"]); }
});
test.each([
  ["cohorts", (r) => r.cohorts("org-A", "P1", 21, 0)],
  ["cohort", (r) => r.cohort("org-A", "P1", "C1")],
  ["enrollments", (r) => r.enrollments("org-A", "P1", "C1", 21, 0)],
  ["enrollment", (r) => r.enrollment("org-A", "P1", "C1", "E1")],
])("%s binds the organisation and all parent identifiers", async (_name, read) => {
  await withOrganizationProgramManagement(credentials, true, read);
  const [sql, args] = query.mock.calls.at(-1);
  expect(sql).toContain("organization_id=?"); expect(sql).toContain("program_id=?"); expect(args.slice(0, 2)).toEqual(["org-A", "P1"]);
  expect(sql).not.toContain("SELECT *");
});
test("member search cannot expose other organisations or private contact fields", async () => {
  await withOrganizationProgramManagement(credentials, false, (r) => r.members("org-A", "%' injection", 21, 0));
  const [sql, args] = query.mock.calls.at(-1);
  expect(query.mock.calls[0][0]).toContain("READ ONLY"); expect(sql).toContain("m.organization_id=?");
  expect(sql).not.toContain("%' injection"); expect(sql).not.toContain("email"); expect(args).toEqual(["org-A", "%' injection", 21, 0]);
});
test("enrollment creation uses a same-organisation membership, cohort and programme tuple", async () => {
  await withOrganizationProgramManagement(credentials, true, (r) => r.enroll("org-A", "P1", "C1", "M1"));
  expect(query.mock.calls.at(-1)[1]).toEqual(["org-A", "P1", "C1", "M1"]);
});
