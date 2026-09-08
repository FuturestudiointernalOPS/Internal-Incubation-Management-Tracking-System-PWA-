/**
 * Contract test — GET /api/ventures/[id]/progress read-layer vocabulary
 * (Vinance 3, Phase 1).
 *
 * Guards that the progress endpoint:
 *   - keeps its response shape (keys + zero-safe numbers)
 *   - derives task completion from the canonical terminal-success set
 *     (done | accepted | completed), never a hardcoded literal
 */

const executed = [];
const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?")) {
      return { rows: [{ id: VENTURE_DB_ID }] };
    }
    if (sql.includes("SELECT COUNT(*) as total") && sql.includes("FROM venture_tasks WHERE venture_id = ?")) {
      // Scripted fixture: 5 tasks, 3 terminal-success
      return { rows: [{ total: 5, done: 3 }] };
    }
    if (sql.includes("SELECT AVG(progress)") && sql.includes("FROM venture_milestones WHERE venture_id = ?")) {
      return { rows: [{ avg_progress: 40 }] };
    }
    if (sql.includes("FROM venture_members WHERE venture_id = ?")) {
      return { rows: [{ count: 2 }] };
    }
    if (sql.includes("SELECT COUNT(*) as count FROM venture_documents")) {
      return { rows: [{ count: 3 }] };
    }
    if (sql.includes("FROM venture_business_models")) return { rows: [{ id: 1 }] };
    if (sql.includes("FROM venture_customer_interviews")) return { rows: [{ count: 2 }] };
    if (sql.includes("FROM venture_validations")) return { rows: [{ count: 3 }] };
    if (sql.includes("FROM venture_pmf_assessments")) return { rows: [{ count: 1 }] };
    if (sql.includes("SELECT name, description, mission, vision, industry, sector, business_stage, website FROM ventures WHERE id = ?")) {
      return { rows: [{ name: "Acme", description: "d", mission: "m", vision: "v", industry: "Fintech", sector: "x", business_stage: "idea", website: "w" }] };
    }
    if (sql.includes("FROM venture_standups")) return { rows: [{ count: 0 }] };
    if (sql.includes("FROM venture_retros")) return { rows: [{ count: 0 }] };
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
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: { cid: "staff-1", role: "super_admin" } }),
}));

const { GET } = require("@/app/api/ventures/[id]/progress/route");

const readJson = async (res) => res.json();

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
});

describe("GET /api/ventures/[id]/progress — completion vocabulary", () => {
  test("response shape is stable and terminal-success tasks are counted", async () => {
    const res = await GET(new Request("http://localhost/api/ventures/VNT-TEST/progress"), { params: { id: "VNT-TEST" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.progress).toEqual({
      task_completion: 60,
      total_tasks: 5,
      completed_tasks: 3,
      avg_milestone_progress: 40,
      standups_count: 0,
      retros_count: 0,
      profile_completion: expect.any(Number),
    });
  });

  test("completion derives from the canonical status set, not 'done' alone", async () => {
    await GET(new Request("http://localhost/api/ventures/VNT-TEST/progress"), { params: { id: "VNT-TEST" } });
    const taskQuery = executed.find((q) => q.sql.includes("SELECT COUNT(*) as total") && q.sql.includes("FROM venture_tasks WHERE venture_id = ?"));
    expect(taskQuery).toBeDefined();
    expect(taskQuery.sql).toContain("status IN (?, ?, ?)");
    expect(taskQuery.args).toEqual(["done", "accepted", "completed", VENTURE_DB_ID]);
  });
});
