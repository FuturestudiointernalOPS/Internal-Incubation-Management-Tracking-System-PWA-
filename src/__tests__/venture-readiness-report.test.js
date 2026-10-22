/**
 * Contract tests — roadmap readiness engine + journey operating report
 * (Vinance 3, Phase 3; reshaped by WS4).
 *
 * GET /api/ventures/[id]/investment-readiness
 *   → TWO deliberately separate indicators, never one merged number:
 *       roadmap_readiness   — journeys/milestones/tasks/deliverables, weighted
 *                             30/30/25/15 and renormalised over what is defined.
 *       data_room_readiness — INVESTMENT READINESS, from the Data Room's own
 *                             completeness engine (required categories only).
 *   → the former eight-document checklist is gone (WS4).
 * GET /api/ventures/[id]/journey-report
 *   → read-only operating report over the canonical spine; staff-only
 */

const executed = [];
const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";
const SESSION = { cid: "staff-1", name: "Test Staff", role: "super_admin" };

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("FROM ventures WHERE venture_id = ?") && !sql.includes("OR id::text")) return { rows: [{ id: VENTURE_DB_ID }] };
    if (sql.includes("FROM ventures WHERE venture_id = ? OR id::text = ?")) return { rows: [{ id: VENTURE_DB_ID }] };
    // ── id resolution + Data Room readiness (investment-readiness route) ──
    if (sql.startsWith("SELECT venture_id AS code, id::text AS id FROM ventures")) {
      return { rows: [{ code: "VNT-TEST", id: VENTURE_DB_ID }] };
    }
    if (sql.startsWith("SELECT id::text AS id, business_stage FROM ventures")) {
      return { rows: [{ id: VENTURE_DB_ID, business_stage: "early_traction" }] };
    }
    if (sql.includes("FROM venture_data_room_requirements")) {
      return { rows: [
        { venture_id: VENTURE_DB_ID, category: "company_overview", level: "required" },
        { venture_id: VENTURE_DB_ID, category: "legal_corporate", level: "required" },
        { venture_id: VENTURE_DB_ID, category: "financial", level: "required" },
        { venture_id: VENTURE_DB_ID, category: "pitch_materials", level: "required" },
        { venture_id: VENTURE_DB_ID, category: "team", level: "recommended" },
      ] };
    }
    if (sql.includes("FROM venture_documents d")) {
      return { rows: [
        { venture_id: VENTURE_DB_ID, category: "company_overview", status: "verified" },
        { venture_id: VENTURE_DB_ID, category: "legal_corporate", status: "verified" },
        { venture_id: VENTURE_DB_ID, category: "financial", status: "uploaded" },
        // A legacy Data Bank row: not a Data Room category, so it must not
        // count towards a requirement — but it is still a stored document.
        { venture_id: VENTURE_DB_ID, category: "business_plan", status: "verified" },
      ] };
    }
    // ── readiness engine (lib/ventureReadiness) ──
    if (sql.startsWith("SELECT status FROM venture_journey_stages")) {
      return { rows: [{ status: "completed" }, { status: "active" }, { status: "upcoming" }] };
    }
    if (sql.startsWith("SELECT status FROM venture_milestones")) {
      return { rows: [{ status: "completed" }, { status: "completed" }, { status: "not_started" }] };
    }
    if (sql.startsWith("SELECT status FROM venture_tasks")) {
      return { rows: [{ status: "done" }, { status: "accepted" }, { status: "backlog" }, { status: "in_progress" }] };
    }
    if (sql.includes("SELECT s.status, s.review_decision")) {
      return { rows: [
        { status: "submitted", review_decision: "approved" },
        { status: "submitted", review_decision: "approved" },
        { status: "submitted", review_decision: "changes_requested" },
      ] };
    }
    // ── journey operating report ──
    if (sql.includes("SELECT id, name, status, stage_order")) {
      return { rows: [
        { id: "s1", name: "Family & Friends", status: "completed", stage_order: 1, target_date: null, completed_at: "2026-01-01T00:00:00Z" },
        { id: "s2", name: "GTM", status: "active", stage_order: 2, target_date: null, completed_at: null },
      ] };
    }
    if (sql.includes("journey_stage_id IS NOT NULL")) {
      return { rows: [
        { journey_stage_id: "s1", status: "completed" },
        { journey_stage_id: "s1", status: "completed" },
        { journey_stage_id: "s2", status: "in_progress" },
      ] };
    }
    if (sql.includes("SELECT status, due_date FROM venture_tasks")) {
      return { rows: [
        { status: "in_progress", due_date: "2026-01-01T00:00:00Z" },
        { status: "cancelled", due_date: "2026-01-01T00:00:00Z" },
        { status: "done", due_date: "2026-01-01T00:00:00Z" },
        { status: "review", due_date: "2025-12-01T00:00:00Z" },
        { status: "backlog", due_date: null },
      ] };
    }
    if (sql.includes("SELECT s.review_decision, s.reviewed_at")) {
      return { rows: [
        { review_decision: "approved", reviewed_at: "2026-01-02T00:00:00Z" },
        { review_decision: "changes_requested", reviewed_at: "2026-01-03T00:00:00Z" },
      ] };
    }
    if (sql.includes("FROM venture_sessions WHERE venture_id IN")) {
      return { rows: [
        { status: "scheduled", venture_facing: true, journey_stage_id: "s2", start_time: "2099-01-01T10:00:00Z" },
        { status: "completed", venture_facing: false, journey_stage_id: "s1", start_time: "2025-01-01T10:00:00Z" },
      ] };
    }
    if (sql.includes("FROM venture_staff_assignments")) {
      return { rows: [
        { responsibility_code: "lead_manager", staff_contact_id: "u1", scope_type: "venture_wide" },
        { responsibility_code: "facilitator", staff_contact_id: "u2", scope_type: "venture_wide" },
      ] };
    }
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue(SESSION),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: SESSION }),
  roleIsPrivileged: jest.requireActual("@/lib/ventureAuth").roleIsPrivileged,
  isStaffActorForVenture: jest.fn().mockResolvedValue(true),
}));

// The operating report READ moved to the canonical venture gate (Lot 5).
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn().mockResolvedValue({ session: SESSION }),
}));

// Phase 5c: this route now goes through requireVentureScopedAccess. The mock
// resolves as Super Admin (the scenario under test), which is the gate's
// bypass path — capability + scope are then not consulted.
jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn().mockResolvedValue({ isSuperAdmin: true }),
  requireAuthorization: jest.fn().mockResolvedValue(null),
}));

const { GET: readinessGET } = require("@/app/api/ventures/[id]/investment-readiness/route");
const { GET: reportGET } = require("@/app/api/ventures/[id]/journey-report/route");

const readJson = async (res) => res.json();
const ctx = { params: { id: "VNT-TEST" } };

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
});

describe("GET /api/ventures/[id]/investment-readiness — two indicators", () => {
  test("roadmap readiness and Data Room readiness are reported separately", async () => {
    const res = await readinessGET(new Request("http://localhost/api/ventures/VNT-TEST/investment-readiness"), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);

    // The eight-document checklist is retired: no legacy keys remain.
    expect(data).not.toHaveProperty("investment_readiness");
    expect(data).not.toHaveProperty("roadmap_readiness.checklist");

    // Roadmap engine (fixtures: 1/3 journeys, 2/3 milestones, 2/4 tasks, 2/3 approved).
    const roadmapReadiness = data.roadmap_readiness;
    expect(roadmapReadiness.counts.journeys).toEqual({ total: 3, completed: 1 });
    expect(roadmapReadiness.counts.milestones).toEqual({ total: 3, completed: 2 });
    expect(roadmapReadiness.counts.tasks).toEqual({ total: 4, completed: 2 });
    expect(roadmapReadiness.counts.deliverables).toEqual({ reviewed: 3, approved: 2, outstanding: 1 });
    expect(roadmapReadiness.components.journeys).toBe(33);
    expect(roadmapReadiness.components.milestones).toBe(67);
    expect(roadmapReadiness.components.tasks).toBe(50);
    expect(roadmapReadiness.components.deliverables).toBe(67);
    // Weighted: 33*.3 + 67*.3 + 50*.25 + 67*.15 = 53 (rounded)
    expect(roadmapReadiness.overall_percent).toBe(53);

    // Data Room engine: 4 required categories, 2 verified, 1 uploaded, 1 missing.
    // The legacy `business_plan` document is a stored file but not a requirement,
    // so it can neither raise nor lower the score.
    const dataRoomReadiness = data.data_room_readiness;
    expect(dataRoomReadiness.readiness_percent).toBe(50);
    expect(dataRoomReadiness.total_required).toBe(4);
    expect(dataRoomReadiness.verified_count).toBe(2);
    expect(dataRoomReadiness.pending_count).toBe(1);
    expect(dataRoomReadiness.missing_count).toBe(1);
    expect(dataRoomReadiness.is_ready).toBe(false);
  });
});

describe("GET /api/ventures/[id]/journey-report — operating report", () => {
  test("report derives every number from the defined roadmap (staff-only)", async () => {
    const res = await reportGET(new Request("http://localhost/api/ventures/VNT-TEST/journey-report"), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    const journeyReport = data.journey_report;

    expect(journeyReport.journey_progression).toEqual({ total: 2, completed: 1, progress_pct: 50 });

    // Stage grouping: s1 has 2/2 milestones complete, s2 has 0/1.
    const firstStage = journeyReport.stages.find((stage) => stage.id === "s1");
    const secondStage = journeyReport.stages.find((stage) => stage.id === "s2");
    expect(firstStage.milestones).toEqual({ total: 2, completed: 2, progress_pct: 100 });
    expect(secondStage.milestones).toEqual({ total: 1, completed: 0, progress_pct: 0 });

    expect(journeyReport.milestones_by_status).toEqual({ completed: 2, in_progress: 1 });
    expect(journeyReport.tasks_by_status).toEqual({ in_progress: 1, cancelled: 1, done: 1, review: 1, backlog: 1 });
    expect(journeyReport.task_completion).toEqual({ total: 5, completed: 1, progress_pct: 20 });

    // Overdue = open statuses only (cancelled/done excluded, null due excluded).
    expect(journeyReport.overdue.length).toBe(2);
    expect(journeyReport.overdue.every((task) => ["in_progress", "review"].includes(task.status))).toBe(true);

    expect(journeyReport.submissions).toEqual({ reviewed_total: 2, approved: 1, changes_requested: 1 });
    expect(journeyReport.sessions.by_status).toEqual({ scheduled: 1, completed: 1 });
    expect(journeyReport.sessions.upcoming).toBe(1);
    expect(journeyReport.sessions.venture_facing_scheduled).toBe(1);
    expect(journeyReport.support).toEqual({
      assignments: 2,
      responsibilities: ["lead_manager", "facilitator"],
    });
  });

  test("non-staff viewers are rejected", async () => {
    require("@/lib/ventureScopedAccess").requireVentureScopedAccess.mockResolvedValueOnce({ session: { cid: "founder-1", role: "founder" } });
    require("@/lib/ventureAuth").isStaffActorForVenture.mockResolvedValueOnce(false);
    const res = await reportGET(new Request("http://localhost/api/ventures/VNT-TEST/journey-report"), ctx);
    expect(res.status).toBe(403);
  });
});
