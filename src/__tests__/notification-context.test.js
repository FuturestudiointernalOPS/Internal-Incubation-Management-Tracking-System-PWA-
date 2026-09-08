/**
 * Contract tests — notification drill-down context (Vinance 3, Phase 1).
 *
 * Pure grouping helper + the grouped read mode on GET /api/notifications
 * (?group_by=context). Guards:
 *   - default notifications payload is unchanged (no `grouped` key)
 *   - grouped mode is additive and builds the breadcrumb tree
 *     venture → journey → milestone → task/session
 *   - rows without context degrade into `general`
 */

const { groupNotificationContext } = require("@/lib/notificationContext");

describe("groupNotificationContext — pure breadcrumb tree", () => {
  test("rows without venture context degrade into general", () => {
    const out = groupNotificationContext([
      { id: 1, title: "Old row" },
      { id: 2, title: "Another", entity_task_id: "t9" },
    ]);
    expect(out.unread_total).toBe(2);
    expect(out.general).toBe(2);
    expect(out.ventures.length).toBe(0);
  });

  test("builds the full venture → journey → milestone → task chain with counts", () => {
    const out = groupNotificationContext([
      { id: 1, entity_venture_id: "v1", entity_journey_stage_id: "j1", entity_milestone_id: "m1", entity_task_id: "t1" },
      { id: 2, entity_venture_id: "v1", entity_journey_stage_id: "j1", entity_milestone_id: "m1", entity_task_id: "t1" },
      { id: 3, entity_venture_id: "v1", entity_journey_stage_id: "j1", entity_milestone_id: "m2", entity_task_id: "t2" },
      { id: 4, entity_venture_id: "v1", entity_journey_stage_id: "j1", entity_session_id: "s9" },
      { id: 5, entity_venture_id: "v1", entity_session_id: "s8" },
      { id: 6, entity_venture_id: "v2", entity_journey_stage_id: "j9", entity_milestone_id: "m9", entity_task_id: "t9" },
    ]);

    expect(out.unread_total).toBe(6);
    expect(out.general).toBe(0);
    expect(out.ventures.length).toBe(2);

    const v1 = out.ventures.find((v) => v.venture_id === "v1");
    expect(v1.count).toBe(5);
    expect(v1.journeys.length).toBe(1);
    const j1 = v1.journeys[0];
    expect(j1.journey_stage_id).toBe("j1");
    expect(j1.count).toBe(4); // rows 1–4
    expect(j1.milestones.length).toBe(2);
    expect(j1.sessions.length).toBe(1); // row 4 (no milestone)

    const m1 = j1.milestones.find((m) => m.milestone_id === "m1");
    expect(m1.count).toBe(2);
    expect(m1.tasks[0]).toEqual({ task_id: "t1", count: 2 });

    // Row 5 attaches to the venture directly.
    expect(v1.sessions.length).toBe(1);
    expect(v1.sessions[0]).toEqual({ session_id: "s8", count: 1 });

    const v2 = out.ventures.find((v) => v.venture_id === "v2");
    expect(v2.count).toBe(1);
    expect(v2.journeys[0].milestones[0].tasks[0]).toEqual({ task_id: "t9", count: 1 });
  });
});

// ── Route-level: GET /api/notifications grouped mode ──
const mockDb = {
  execute: jest.fn(async () => ({
    rows: [
      { id: 1, is_read: 0, entity_venture_id: "v1", entity_journey_stage_id: "j1", entity_task_id: "t1" },
      { id: 2, is_read: 0, entity_venture_id: null },
      { id: 3, is_read: 1, entity_venture_id: "v1" }, // read → excluded
    ],
  })),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn().mockResolvedValue({ cid: "founder-1", role: "founder" }),
}));

const { GET } = require("@/app/api/notifications/route");
const readJson = async (res) => res.json();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/notifications — grouped mode is additive", () => {
  test("default mode returns exactly the legacy payload shape", async () => {
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(data.notifications.length).toBe(2); // read row filtered
    expect(data.grouped).toBeUndefined();
  });

  test("?group_by=context adds the breadcrumb tree without touching notifications", async () => {
    const res = await GET(new Request("http://localhost/api/notifications?group_by=context"));
    const data = await readJson(res);
    expect(data.notifications.length).toBe(2);
    expect(data.grouped.unread_total).toBe(2);
    expect(data.grouped.general).toBe(1);
    expect(data.grouped.ventures[0].venture_id).toBe("v1");
    expect(data.grouped.ventures[0].journeys[0].tasks[0]).toEqual({ task_id: "t1", count: 1 });
  });
});
