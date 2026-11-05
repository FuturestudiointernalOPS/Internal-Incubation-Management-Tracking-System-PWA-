/**
 * The journey's "X / Y tasks done" counts a task finished when its linked
 * deliverable is approved (the approval never rewrites the task row).
 */
const mockModels = {};
jest.mock("@/models/ventureJourney", () => mockModels, { virtual: true });

describe("journeyRead task counts", () => {
  test("reads the task status the count needs", () => {
    const fs = require("node:fs");
    const source = fs.readFileSync("src/models/ventureJourney/journeyStages.js", "utf8");
    const block = source.slice(source.indexOf("export async function listJourneyTasksByMilestoneIds"));
    expect(block.slice(0, block.indexOf("args:"))).toContain("source_ref, status");
  });

  test("an approved linked deliverable finishes its task, once, within the total", () => {
    const fs = require("node:fs");
    const source = fs.readFileSync("src/services/ventures/journeyRead.js", "utf8");
    expect(source).toContain('deliverable.approval_status === "approved" && deliverable.task_id != null');
    expect(source).toContain("Math.min(milestone.task_counts.total, milestone.task_counts.done + alsoDone)");
  });
});
