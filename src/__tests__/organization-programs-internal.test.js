jest.mock("@/lib/db", () => ({ __esModule: true, default: { execute: jest.fn(async () => ({ rows: [] })) } }));
import db from "@/lib/db";
import { PLATFORM_ORGANIZATION_ID, platformProgramPredicate } from "@/models/organizations/programScope";
import { getAllPrograms, getProgramExists, updateProgramFields } from "@/models/programs/core/quickPrograms";
import { autoActivatePlannedPrograms, listProgramsByManagementFilters } from "@/models/programs/core/programList";
import { getProgramDetailById, getProgramSourceById, getProgramTemplateById, listProgramTemplates, updateProgramAssignmentColumn } from "@/models/programs/extended";
import { getProgramManager, setProgramManager } from "@/models/programs/core/programManager";

beforeEach(() => jest.clearAllMocks());

test("the compatibility predicate binds the platform identity and rejects an injected alias", () => {
  expect(platformProgramPredicate("p")).toContain("to_jsonb(p)->>'organization_id'");
  expect(platformProgramPredicate()).toContain(PLATFORM_ORGANIZATION_ID);
  expect(() => platformProgramPredicate("p); SELECT secret")).toThrow("Invalid SQL alias");
});

test.each([
  ["directory", () => getAllPrograms()],
  ["exists", () => getProgramExists("program")],
  ["update", () => updateProgramFields(["name = ?"], ["changed", "program"])],
  ["activation", () => autoActivatePlannedPrograms()],
  ["detail", () => getProgramDetailById("program")],
  ["source", () => getProgramSourceById("program")],
  ["template", () => getProgramTemplateById("program")],
  ["templates", () => listProgramTemplates()],
  ["assignment", () => updateProgramAssignmentColumn("assigned_pm_id", "person", "program")],
  ["manager", () => getProgramManager("program")],
  ["set manager", () => setProgramManager("program", "person")],
])("internal %s cannot fall back to a global programme query", async (_name, read) => {
  await read();
  const input = db.execute.mock.calls[0][0];
  const sql = typeof input === "string" ? input : input.sql;
  expect(sql).toContain("organization_id");
  expect(sql).toContain(PLATFORM_ORGANIZATION_ID);
  expect(sql).toContain("to_jsonb(");
});

test.each([true, false])("showAll=%s cannot remove the platform boundary even for super-admin", async (showAll) => {
  await listProgramsByManagementFilters({ showAll, session: { role: "super_admin" } });
  expect(db.execute.mock.calls[0][0].sql).toContain(platformProgramPredicate("p"));
});
