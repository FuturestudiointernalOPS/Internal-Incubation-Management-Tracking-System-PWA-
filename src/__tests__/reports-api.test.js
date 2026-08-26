/**
 * Integration tests for the Standup/Retro submit APIs —
 * expected-deliverables persistence and context-aware upserts
 * (bugs #1 and #11).
 */

const mockExecutedQueries = [];
let mockInsertId = 10;

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args }) => {
      mockExecutedQueries.push({ sql, args });
      // Existing-report check → no existing row (forces INSERT path)
      if (sql.includes("SELECT id FROM v2_op_reports")) {
        return { rows: [] };
      }
      if (sql.includes("RETURNING id")) {
        return { rows: [{ id: mockInsertId++ }] };
      }
      if (sql.includes("SELECT role FROM contacts")) {
        return { rows: [{ role: "staff" }] };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue({
    cid: "staff-1",
    name: "Staff One",
    role: "staff",
  }),
}));

jest.mock("@/lib/audit", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(true),
}));

// Phase 3: the submit routes now gate through the canonical authorization
// resolver. Authorization is out of scope for these business-logic tests,
// so the gate is mocked as granted.
jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/db/queries/tasks", () => ({
  getTaskTitleById: jest.fn().mockResolvedValue("Some task"),
}));

const { POST: submitStandup } = require("@/app/api/standups/submit/route");
const { POST: submitRetro } = require("@/app/api/retros/submit/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/standups/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

beforeEach(() => {
  mockExecutedQueries.length = 0;
  mockInsertId = 10;
});

describe("POST /api/standups/submit", () => {
  const base = {
    user_id: "staff-1",
    user_name: "Staff One",
    user_role: "staff",
    week_number: 33,
    year: 2026,
    context_type: "staff",
    context_id: null,
  };

  test("persists expected deliverables as JSON", async () => {
    const res = await submitStandup(
      jsonReq({
        ...base,
        top_priorities: ["Priority A", "Priority B"],
        expected_deliverables: ["Ship onboarding v1", "Publish Q3 budget"],
        additional_notes: "All on track",
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);

    const insert = mockExecutedQueries.find((q) => q.sql.includes("INSERT INTO v2_op_reports"));
    expect(insert).toBeDefined();
    const expectedDeliverablesArg = insert.args.find(
      (a) => typeof a === "string" && a.includes("Q3 budget"),
    );
    expect(expectedDeliverablesArg).toBe(
      JSON.stringify(["Ship onboarding v1", "Publish Q3 budget"]),
    );
  });

  test("upsert lookup is scoped by context to avoid cross-context overwrites", async () => {
    await submitStandup(jsonReq(base));
    const lookup = mockExecutedQueries.find(
      (q) => q.sql.includes("SELECT id FROM v2_op_reports") && q.sql.includes("'standup'"),
    );
    expect(lookup).toBeDefined();
    expect(lookup.sql).toContain("context_type = ?");
  });

  test("rejects missing required fields", async () => {
    const res = await submitStandup(jsonReq({ user_id: "staff-1" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/retros/submit", () => {
  const base = {
    user_id: "staff-1",
    user_name: "Staff One",
    user_role: "staff",
    week_number: 33,
    year: 2026,
    context_type: "staff",
    context_id: null,
  };

  test("persists retro fields and reconciles task statuses", async () => {
    const res = await submitRetro(
      jsonReq({
        ...base,
        wins: ["Shipped onboarding", "Closed Q3 budget"],
        challenges: "Scope creep on migration",
        carryover_items: ["Migration follow-ups"],
        reconciliation: [
          { task_id: 1, status: "completed" },
          { task_id: 2, status: "carried_over" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.reconciledTasks).toHaveLength(2);

    const insert = mockExecutedQueries.find(
      (q) => q.sql.includes("INSERT INTO v2_op_reports") && q.sql.includes("'retro'"),
    );
    expect(insert).toBeDefined();
    // The retro route passes the wins value through for persistence
    const winsArg = insert.args.find(
      (a) => a != null && String(a).includes("Q3 budget"),
    );
    expect(winsArg).toBeTruthy();
  });

  test("upsert lookup is scoped by context", async () => {
    await submitRetro(jsonReq(base));
    const lookup = mockExecutedQueries.find(
      (q) => q.sql.includes("SELECT id FROM v2_op_reports") && q.sql.includes("'retro'"),
    );
    expect(lookup).toBeDefined();
    expect(lookup.sql).toContain("context_type = ?");
  });
});
