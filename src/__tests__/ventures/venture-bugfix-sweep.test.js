/**
 * VENTURES — the bugs found while walking every venture screen.
 *
 * Each case pins one fix: a request that failed (500) or a screen that said the
 * wrong thing on a real Venture.
 */

// ── The timeline + reports routes read the Venture's INTERNAL id ─────────────
const mockResolveDbId = jest.fn();
const mockGantt = jest.fn();
const mockProgress = jest.fn();
const mockDelay = jest.fn();
const mockTimeline = jest.fn();
const mockAnalytics = jest.fn();
const mockMilestonesReport = jest.fn();

jest.mock("@/lib/api/createHandler", () => ({ createHandler: (handler) => handler }));
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn().mockResolvedValue({ session: { cid: "c1", role: "super_admin" } }),
}));
jest.mock("@/lib/ventureOwnership", () => ({ resolveVentureDbId: (...args) => mockResolveDbId(...args) }));
jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: { cid: "c1", role: "super_admin" } }),
  isStaffActorForVenture: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/services/ventures/timeline", () => ({
  getProjectTimeline: (...args) => mockTimeline(...args),
  getGanttData: (...args) => mockGantt(...args),
  calculateProjectProgress: (...args) => mockProgress(...args),
  getDelaySummary: (...args) => mockDelay(...args),
  addDependency: jest.fn(),
  removeDependency: jest.fn(),
}));
jest.mock("@/services/ventures/analytics", () => ({
  getVentureAnalytics: (...args) => mockAnalytics(...args),
  getMilestonesReport: (...args) => mockMilestonesReport(...args),
  getTasksReport: jest.fn().mockResolvedValue([]),
  getTeamProductivity: jest.fn().mockResolvedValue([]),
  getExportData: jest.fn().mockResolvedValue([]),
}));

const timelineRoute = require("@/app/api/ventures/[id]/timeline/route");
const reportsRoute = require("@/app/api/ventures/[id]/reports/route");

const ctx = { params: Promise.resolve({ id: "VNT-651CED8E" }) };
const get = (path) => ({ url: `http://localhost/api/ventures/VNT-651CED8E/${path}` });
const UUID = "b1f5cbc3-b8b3-41f7-8ccc-3bec138365ed";

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveDbId.mockResolvedValue(UUID);
  mockGantt.mockResolvedValue({ rows: [] });
  mockProgress.mockResolvedValue({ overall: 0 });
  mockDelay.mockResolvedValue({ overdue_tasks: [] });
  mockTimeline.mockResolvedValue({ events: [] });
  mockAnalytics.mockResolvedValue({ summary: {} });
  mockMilestonesReport.mockResolvedValue([]);
});

describe("timeline route — the human code is resolved before the tables are read", () => {
  test.each([
    ["timeline?view=gantt", () => mockGantt],
    ["timeline?view=progress", () => mockProgress],
    ["timeline?view=delay", () => mockDelay],
    ["timeline", () => mockTimeline],
  ])("%s reads with the internal id, never the VNT code", async (path, service) => {
    const res = await timelineRoute.GET(get(path), ctx);
    expect(res.status).toBe(200);
    expect(service()).toHaveBeenCalledWith(UUID);
  });

  test("a Venture that cannot be resolved is a 404, not a 500", async () => {
    mockResolveDbId.mockResolvedValue(null);
    const res = await timelineRoute.GET(get("timeline?view=gantt"), ctx);
    expect(res.status).toBe(404);
    expect(mockGantt).not.toHaveBeenCalled();
  });
});

describe("reports route — same rule", () => {
  test("analytics and milestone reports read with the internal id", async () => {
    await reportsRoute.GET(get("reports?type=analytics"), ctx);
    await reportsRoute.GET(get("reports?type=milestones"), ctx);
    expect(mockAnalytics).toHaveBeenCalledWith(UUID);
    expect(mockMilestonesReport).toHaveBeenCalledWith(UUID);
  });

  test("an unknown Venture is a 404", async () => {
    mockResolveDbId.mockResolvedValue(null);
    const res = await reportsRoute.GET(get("reports?type=analytics"), ctx);
    expect(res.status).toBe(404);
  });
});

// ── SQL shapes ───────────────────────────────────────────────────────────────
describe("model queries", () => {
  test("upcoming deadlines: both halves of the UNION have the same id type, ordered by the output column", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(process.cwd(), "src/models/ventureTimelineStore.js"), "utf8");
    const block = src.slice(src.indexOf("export function selectUpcomingDeadlines"));
    expect(block).toContain("id::text AS id, title, 'task'");
    expect(block).toContain("id::text AS id, title, 'milestone'");
    expect(block).toContain("ORDER BY due_date ASC");
    expect(block).not.toContain("ORDER BY target_date");
  });

  test("the journey report compares milestone owners as text (the code is not a UUID)", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(process.cwd(), "src/models/ventureWorkspace/journeyAndReports/journeyReports.js"), "utf8");
    const block = src.slice(src.indexOf("export function listVentureMilestonesForReport"), src.indexOf("export function listVentureTaskDeadlinesForReport"));
    expect(block).toContain("venture_id::text IN (");
  });
});

describe("milestone list order", () => {
  test("milestones come back in roadmap order, not by an identical creation time", () => {
    const fs = require("fs");
    const path = require("path");
    const src = fs.readFileSync(path.join(process.cwd(), "src/models/ventureWorkspace/milestonesAndAccess.js"), "utf8");
    const start = src.indexOf("export async function listVentureMilestonesByDbId");
    const block = src.slice(start, src.indexOf("/**", start));
    expect(block).toContain("ORDER BY display_order ASC NULLS LAST, created_at ASC");
    expect(block).not.toContain("created_at DESC");
  });
});
