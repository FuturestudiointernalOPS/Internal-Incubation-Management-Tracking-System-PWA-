jest.mock("@/lib/db", () => ({ __esModule: true, initDb: jest.fn(async () => {}), default: { execute: jest.fn(async () => ({ rows: [] })) } }));
jest.mock("@/services/programs/kpiProgress", () => ({ recalculateKpiProgress: jest.fn(async () => []), refreshKpiProgressIfStale: jest.fn(async () => {}) }));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(async () => ({ cid: "STAFF", role: "super_admin" })) }));
jest.mock("@/server/authz/guards", () => ({ requireProgramFacilitator: jest.fn() }));
jest.mock("@/services/authorization/programManagement", () => ({ isProgramManagerSession: jest.fn(async () => true) }));
jest.mock("@/models/authorization/accessQueries", () => ({ isAssignedPmForProgram: jest.fn() }));
jest.mock("@/services/authorization/programAccessProjection", () => ({ projectProgramAccess: jest.fn(async () => ({ canView: true })) }));
import db from "@/lib/db";
import { getProgramFullStateData, getProgramExportRows, getPersistedKpiProgress, getSuperAdminSchedule, getOwnSchedule, getProgramsByAssignedPm, getSubmissionsByProgramIds } from "@/models/programWorkspace";
import { buildProgramFullState } from "@/services/programs/fullState";
import { recalculateKpiProgress, refreshKpiProgressIfStale } from "@/services/programs/kpiProgress";
import { PLATFORM_ORGANIZATION_ID } from "@/models/organizations/programScope";
import { projectProgramAccess } from "@/services/authorization/programAccessProjection";
import { GET } from "@/app/api/pm/full-state/route";

const id = "44444444-4444-4444-8444-444444444444";
beforeEach(() => { jest.clearAllMocks(); db.execute.mockResolvedValue({ rows: [] }); });

test("all fourteen workspace reads, including staff choices, gate the parent in the same statement", async () => {
  const rows = await getProgramFullStateData(id);
  expect(rows).toHaveLength(14);
  expect(db.execute).toHaveBeenCalledTimes(14);
  for (const [{ sql, args }] of db.execute.mock.calls) {
    expect(sql).toContain("WHERE EXISTS (");
    expect(sql).toContain(PLATFORM_ORGANIZATION_ID);
    expect(args.at(-1)).toBe(id);
    expect(sql.split("?").length - 1).toBe(args.length);
  }
});

test.each(["participants", "attendance", "submissions", "teams", "ical"])("%s export binds its parent separately from the business query", async (type) => {
  await getProgramExportRows(type, id);
  const [{ sql, args }] = db.execute.mock.calls[0];
  expect(sql).toContain("$1");
  expect(sql).toContain("wl_parent.id::text = $2");
  expect(sql).toContain(PLATFORM_ORGANIZATION_ID);
  expect(args).toEqual([id, id]);
});

test.each([
  ["KPI cache", () => getPersistedKpiProgress(id)],
  ["owner schedule", () => getSuperAdminSchedule()],
  ["own schedule", () => getOwnSchedule("STAFF")],
  ["assigned programmes", () => getProgramsByAssignedPm("STAFF")],
  ["submissions", () => getSubmissionsByProgramIds([id, "foreign"])],
])("%s retains the platform ownership boundary", async (_name, read) => {
  await read();
  expect(db.execute.mock.calls[0][0].sql).toContain(PLATFORM_ORGANIZATION_ID);
});

test("an empty submission scope never becomes a directory query", async () => {
  expect(await getSubmissionsByProgramIds([])).toEqual({ rows: [] });
  expect(db.execute).not.toHaveBeenCalled();
});

test("missing or excluded parent stops KPI recalculation and all follow-up reads", async () => {
  expect(await buildProgramFullState({ id, includeMetrics: true })).toEqual({ success: false, error: "errors.notFound" });
  expect(db.execute).toHaveBeenCalledTimes(14);
  expect(recalculateKpiProgress).not.toHaveBeenCalled();
  expect(refreshKpiProgressIfStale).not.toHaveBeenCalled();
});

test("an available platform parent still assembles the workspace response", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{ id, name: "Synthetic platform programme" }] });
  const result = await buildProgramFullState({ id });
  expect(result).toMatchObject({ success: true, program: { id }, participants: [], sessions: [], staffList: [] });
});

test("the real full-state controller returns 404 before access projection for an unavailable parent", async () => {
  const response = await GET(new Request(`http://localhost/api/pm/full-state?id=${id}&metrics=true`));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ success: false, error: "errors.notFound" });
  expect(projectProgramAccess).not.toHaveBeenCalled();
  expect(recalculateKpiProgress).not.toHaveBeenCalled();
});

test("the real full-state controller preserves a valid platform workspace response", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{ id, name: "Synthetic platform programme" }] });
  const response = await GET(new Request(`http://localhost/api/pm/full-state?id=${id}`));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ success: true, program: { id }, access: { canView: true } });
});
