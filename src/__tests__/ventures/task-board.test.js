/**
 * Lane L2 — the task board moved out of the tasks controller
 * (`services/ventures/taskBoard.js`, buildTaskBoard). Characterises the
 * archived filter, the Kanban columns and the dependency decoration.
 */

jest.mock("@/lib/ventureAuth", () => ({}));
jest.mock("@/services/ventures/milestoneEngine", () => ({}));
jest.mock("@/models/ventureWorkspace", () => ({}));

const { buildTaskBoard, TASK_PROCEED_STATUSES } = require("@/services/ventures/taskBoard");
const { TASK_BOARD_COLUMNS } = require("@/lib/ventureStatuses");

const tasks = [
  { id: 1, title: "Interview users", status: "done" },
  { id: 2, title: "Identify ICPs", status: "todo" },
  { id: 3, title: "Pitch", status: "todo" },
  { id: 4, title: "Old", status: "todo", is_archived: true },
];
// 1 blocks 3 (done → met), 2 blocks 3 (todo → unmet)
const edges = [
  { source_id: "1", target_id: "3" },
  { source_id: "2", target_id: "3" },
];

describe("buildTaskBoard", () => {
  test("every Kanban column exists, even empty", () => {
    const { byStatus } = buildTaskBoard([], [], false);
    expect(Object.keys(byStatus)).toEqual(TASK_BOARD_COLUMNS);
  });

  test("archived tasks are hidden unless asked for", () => {
    expect(buildTaskBoard(tasks, edges, false).tasks.map((task) => task.id)).toEqual([1, 2, 3]);
    expect(buildTaskBoard(tasks, edges, true).tasks.map((task) => task.id)).toEqual([1, 2, 3, 4]);
  });

  test("dependency edges decorate both ends; only unmet blockers block", () => {
    const board = buildTaskBoard(tasks, edges, false).tasks;
    const pitch = board.find((task) => task.id === 3);
    expect(pitch.blocked_by_ids).toEqual(["1", "2"]);
    expect(pitch.dependency_blocked).toBe(true);
    expect(pitch.blocked_by_titles).toEqual(["Identify ICPs"]);
    const interviews = board.find((task) => task.id === 1);
    expect(interviews.blocks_ids).toEqual(["3"]);
    expect(interviews.dependency_blocked).toBe(false);
  });

  test("progress statuses are the gated ones", () => {
    expect(TASK_PROCEED_STATUSES).toEqual(expect.arrayContaining(["in_progress", "review"]));
    expect(TASK_PROCEED_STATUSES).not.toContain("todo");
  });
});
