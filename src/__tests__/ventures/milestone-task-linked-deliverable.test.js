/**
 * A task whose linked deliverable is approved is finished: the milestone sync
 * reads it as `done`, so a milestone whose deliverables are all approved can
 * close (for an actor who may close it) instead of waiting on tasks that the
 * approval never rewrites.
 */
const executed = [];
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async (query) => { executed.push(query); return { rows: [] }; }) },
  initDb: jest.fn().mockResolvedValue(true),
}));

const store = require("@/models/ventureMilestoneEngineStore");

test("the milestone's task read treats an approved linked deliverable as done", async () => {
  await store.selectActiveTaskStatusesForMilestone("m1");
  const { sql, args } = executed[0];
  expect(sql).toContain("FROM venture_deliverables d");
  expect(sql).toContain("d.task_id = venture_tasks.id AND d.approval_status = 'approved'");
  expect(sql).toContain("THEN 'done' ELSE status END AS status");
  expect(sql).toContain("FROM venture_tasks WHERE milestone_id::text = ?");
  expect(args).toEqual(["m1"]);
});
