/**
 * Contract tests — roadmap readiness engine + journey operating report
 * (Vinance 3, Phase 3).
 *
 * GET /api/ventures/[id]/investment-readiness
 *   → legacy document-checklist keys preserved untouched (cutover window)
 *   → roadmap_readiness derived live from the defined progression
 *     (journeys 30% / milestones 30% / tasks 25% / deliverables 15%,
 *      renormalized over defined components)
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
    // ── legacy document checklist (investment-readiness route) ──
    if (sql.includes("FROM venture_documents WHERE venture_id = ?") && sql.includes("approval_status")) {
      return { rows: [
        { name: "deck.pdf", category: "investment", approval_status: "approved" },
        { name: "bmc.pdf", category: "business", approval_status: "approved" },
        { name: "draft.pdf", category: "legal", approval_status: "pending" },
      ] };
    }
    // ── readiness engine (lib/ventureReadiness) ──
    if (sql.startsWith("SELECT status FROM venture_journey_stages")) {
      return { rows: [{ status: "completed" }, { status: "active" }, { status: "locked" }] };
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

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue(SESSION),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: SESSION }),
  roleIsPrivileged: jest.requireActual("@/lib/ventureAuth").roleIsPrivileged,
  isStaffActorForVenture: jest.fn().mockResolvedValue(true),
}));

// Phase 5c: this route now goes through requireVentureScopedAccess. The mock
// resolves as Super Admin (the scenario under test), which is the gate's
// bypass path — capability + scope are then not consulted.
jest.mock("@/lib/authorization", () => ({
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

describe("GET /api/ventures/[id]/investment-readiness — roadmap engine cutover", () => {
  test("legacy document-checklist keys are preserved and roadmap_readiness is additive", async () => {
    const res = await readinessGET(new Request("http://localhost/api/ventures/VNT-TEST/investment-readiness"), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);

    // Legacy contract untouched: checklist + document-derived score present.
    const ir = data.investment_readiness;
    expect(Array.isArray(ir.checklist)).toBe(true);
    expect(ir.checklist.length).toBe(8); // REQUIRED_DOCUMENTS list
    expect(typeof ir.readiness_percent).toBe("number");
    expect(typeof ir.is_investment_ready).toBe("boolean");
    expect(Array.isArray(ir.missing_documents)).toBe(true);
    expect(Array.isArray(ir.submitted_documents)).toBe(true);

    // Roadmap engine (fixtures: 1/3 journeys, 2/3 milestones, 2/4 tasks, 2/3 approved).
    const rr = data.roadmap_readiness;
    expect(rr.counts.journeys).toEqual({ total: 3, completed: 1 });
    expect(rr.counts.milestones).toEqual({ total: 3, completed: 2 });
    expect(rr.counts.tasks).toEqual({ total: 4, completed: 2 });
    expect(rr.counts.deliverables).toEqual({ reviewed: 3, approved: 2, outstanding: 1 });
    expect(rr.components.journeys).toBe(33);
    expect(rr.components.milestones).toBe(67);
    expect(rr.components.tasks).toBe(50);
    expect(rr.components.deliverables).toBe(67);
    // Weighted: 33*.3 + 67*.3 + 50*.25 + 67*.15 = 53 (rounded)
    expect(rr.overall_percent).toBe(53);
  });
});

describe("GET /api/ventures/[id]/journey-report — operating report", () => {
  test("report derives every number from the defined roadmap (staff-only)", async () => {
    const res = await reportGET(new Request("http://localhost/api/ventures/VNT-TEST/journey-report"), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    const rep = data.journey_report;

    expect(rep.journey_progression).toEqual({ total: 2, completed: 1, progress_pct: 50 });

    // Stage grouping: s1 has 2/2 milestones complete, s2 has 0/1.
    const s1 = rep.stages.find((s) => s.id === "s1");
    const s2 = rep.stages.find((s) => s.id === "s2");
    expect(s1.milestones).toEqual({ total: 2, completed: 2, progress_pct: 100 });
    expect(s2.milestones).toEqual({ total: 1, completed: 0, progress_pct: 0 });

    expect(rep.milestones_by_status).toEqual({ completed: 2, in_progress: 1 });
    expect(rep.tasks_by_status).toEqual({ in_progress: 1, cancelled: 1, done: 1, review: 1, backlog: 1 });
    expect(rep.task_completion).toEqual({ total: 5, completed: 1, progress_pct: 20 });

    // Overdue = open statuses only (cancelled/done excluded, null due excluded).
    expect(rep.overdue.length).toBe(2);
    expect(rep.overdue.every((t) => ["in_progress", "review"].includes(t.status))).toBe(true);

    expect(rep.submissions).toEqual({ reviewed_total: 2, approved: 1, changes_requested: 1 });
    expect(rep.sessions.by_status).toEqual({ scheduled: 1, completed: 1 });
    expect(rep.sessions.upcoming).toBe(1);
    expect(rep.sessions.venture_facing_scheduled).toBe(1);
    expect(rep.support).toEqual({
      assignments: 2,
      responsibilities: ["lead_manager", "facilitator"],
    });
  });

  test("non-staff viewers are rejected", async () => {
    require("@/lib/ventureAuth").requireVentureAccess.mockResolvedValueOnce({ session: { cid: "founder-1", role: "founder" } });
    require("@/lib/ventureAuth").isStaffActorForVenture.mockResolvedValueOnce(false);
    const res = await reportGET(new Request("http://localhost/api/ventures/VNT-TEST/journey-report"), ctx);
    expect(res.status).toBe(403);
  });
});
