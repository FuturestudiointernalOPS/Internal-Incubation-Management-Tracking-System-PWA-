/**
 * Venture playbook templates (Phase 5) — unit tests for assignPlaybookToVenture.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

const db = require("@/lib/db").default;
const { assignPlaybookToVenture } = require("@/lib/ventureTemplates");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("assignPlaybookToVenture", () => {
  it("skips when a playbook is already assigned to the venture", async () => {
    db.execute.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // existing instance

    const result = await assignPlaybookToVenture({ templateId: 3, ventureId: "VNT-ABC", actorCid: "STAFF_1" });

    expect(result).toEqual({ skipped: true, reason: "A playbook is already assigned to this venture." });
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("snapshots stages, milestones and tasks into the venture's execution tables", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [] }) // 1. existing instance (none)
      .mockResolvedValueOnce({ rows: [{ id: 1, stage_order: 1, name: "Validate Market", description: null, objective: null, completion_criteria: null }] }) // 2. stages
      .mockResolvedValueOnce({ rows: [{ stage_id: 1, id: 10, name: "Validate Market", description: null, expected_outcome: null, default_due_days: 14 }] }) // 3. milestones
      .mockResolvedValueOnce({ rows: [{ id: 100, milestone_template_id: 10, name: "Interview 10 customers", description: null, requirement_type: "activity" }] }) // 4. tasks
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // 5. instance insert
      .mockResolvedValueOnce({ rows: [] }) // 6. instance stage insert
      .mockResolvedValueOnce({ rows: [{ id: 50 }] }) // 7. milestone insert
      .mockResolvedValueOnce({ rows: [] }); // 8. task insert

    const result = await assignPlaybookToVenture({ templateId: 3, ventureId: "VNT-ABC", actorCid: "STAFF_1" });

    expect(result).toEqual({ success: true, instance_id: 1, stages: 1, milestones: 1, tasks: 1 });

    // Instance snapshot carries provenance
    const instanceCall = db.execute.mock.calls[4][0];
    expect(instanceCall.sql).toContain("INSERT INTO venture_playbook_instances");
    expect(instanceCall.args).toEqual(["VNT-ABC", 3, "STAFF_1"]);

    // Milestone snapshot: venture-scoped + template_id provenance + due date
    const msCall = db.execute.mock.calls[6][0];
    expect(msCall.sql).toContain("INSERT INTO venture_milestones");
    expect(msCall.sql).toContain("'not_started', 0");
    expect(msCall.args[0]).toBe("VNT-ABC");
    expect(msCall.args[1]).toBe(10); // template_id
    expect(msCall.args[2]).toBe("Validate Market");
    expect(new Date(msCall.args[4]).getTime()).toBeGreaterThan(Date.now()); // target_date ~14 days

    // Task snapshot: template_id + milestone link + requirement type
    const taskCall = db.execute.mock.calls[7][0];
    expect(taskCall.sql).toContain("INSERT INTO venture_tasks");
    expect(taskCall.args[0]).toBe("VNT-ABC");
    expect(taskCall.args[1]).toBe(50); // milestone_id
    expect(taskCall.args[2]).toBe(100); // template_id
    expect(taskCall.args[5]).toBe("activity"); // requirement_type
  });

  it("skips when the template has no stages", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [] }) // existing instance
      .mockResolvedValueOnce({ rows: [] }); // stages (none)

    const result = await assignPlaybookToVenture({ templateId: 3, ventureId: "VNT-ABC", actorCid: "STAFF_1" });

    expect(result).toEqual({ skipped: true, reason: "The playbook template has no stages." });
  });
});
