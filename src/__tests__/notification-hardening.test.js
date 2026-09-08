/**
 * Contract tests — notification hardening (Vinance 3, low-noise pass).
 *
 * Guards:
 *   - createVentureNotification is IDEMPOTENT per (recipient, dedupe_key):
 *     a retried producer never creates a second notification (noise control)
 *   - template_key/params are stored additively (title/message still written,
 *     so legacy consumers keep working)
 *   - resolveNotificationTarget maps entity context → correct staff/member
 *     surface, and legacy rows (no context) degrade to null href
 *   - GET /api/notifications marks fetched rows as SEEN (seen_at), while
 *     read stays a separate PATCH action
 */

const executed = [];

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT 1 FROM v2_notifications WHERE recipient_id = ? AND dedupe_key = ?")) {
      return { rows: executed.filter((q) => q.sql.includes("INSERT INTO v2_notifications") && q.args[0] === args[0] && q.args[q.args.length - 1] === args[1]).length ? [{ 1: 1 }] : [] };
    }
    if (sql.includes("SELECT venture_id FROM ventures WHERE id = ?")) {
      return { rows: [{ venture_id: "VNT-TEST" }] };
    }
    if (sql.includes("SELECT contact_id FROM venture_members WHERE venture_id = ?")) {
      return { rows: [{ contact_id: "founder-1" }] };
    }
    if (sql.includes("SELECT * FROM v2_notifications WHERE recipient_id = ?")) {
      return { rows: [
        { id: 1, is_read: 0, title: "Hello", entity_venture_id: "v-uuid" },
        { id: 2, is_read: 0, title: "World", entity_venture_id: null },
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
  getSession: jest.fn().mockResolvedValue({ cid: "founder-1", role: "founder" }),
}));

const { createVentureNotification, notifyVentureFounders } = require("@/lib/ventures");
const { resolveNotificationTarget, deepestEntity } = require("@/lib/notificationLinks");
const { GET } = require("@/app/api/notifications/route");
const readJson = async (res) => res.json();

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
});

describe("createVentureNotification — idempotency + template storage", () => {
  test("same dedupe_key never creates a second notification for the same recipient", async () => {
    const opts = {
      recipient_id: "founder-1",
      title: "Submission approved",
      message: "Your submission for X was approved.",
      templateKey: "venture.notif.submissionApproved",
      params: { taskTitle: "X" },
      dedupeKey: "submission-review:42:approved",
    };
    await createVentureNotification(opts);
    const first = await createVentureNotification(opts);
    expect(first.skipped).toBe(true);
    const inserts = executed.filter((q) => q.sql.includes("INSERT INTO v2_notifications"));
    expect(inserts.length).toBe(1);
  });

  test("insert carries title/message (legacy display) PLUS template_key/params (future i18n)", async () => {
    await createVentureNotification({
      recipient_id: "founder-1",
      title: "Submission approved",
      message: "Legacy fallback text",
      templateKey: "venture.notif.submissionApproved",
      params: { taskTitle: "Deck" },
      dedupeKey: "k1",
      context: { venture_id: "v1", task_id: "t1" },
    });
    const insert = executed.find((q) => q.sql.includes("INSERT INTO v2_notifications"));
    expect(insert).toBeDefined();
    expect(insert.sql).toContain("template_key");
    expect(insert.sql).toContain("params");
    expect(insert.sql).toContain("dedupe_key");
    expect(insert.args).toEqual(
      expect.arrayContaining(["founder-1", "Submission approved", "Legacy fallback text", "venture.notif.submissionApproved", JSON.stringify({ taskTitle: "Deck" }), "k1"]),
    );
  });

  test("notifyVentureFounders fans out with context + template + dedupe per founder", async () => {
    await notifyVentureFounders("db-uuid", "Stage completed", "msg", { journey_stage_id: "s1" }, {
      templateKey: "venture.notif.stageCompleted",
      params: { stageName: "GTM" },
      dedupeKey: "journey-stage-complete:s1",
    });
    const inserts = executed.filter((q) => q.sql.includes("INSERT INTO v2_notifications"));
    // founder-1 + "sa" overview row
    expect(inserts.length).toBe(2);
    expect(inserts[0].args).toEqual(expect.arrayContaining(["founder-1", "venture.notif.stageCompleted", "journey-stage-complete:s1"]));
    expect(inserts[1].args[0]).toBe("sa");
    expect(inserts[1].args).toEqual(expect.arrayContaining(["sa:journey-stage-complete:s1"]));
  });
});

describe("resolveNotificationTarget — deep-link registry", () => {
  test("deepest entity wins and surfaces differ by role", () => {
    const row = { entity_venture_id: "v-uuid", entity_journey_stage_id: "s1", entity_milestone_id: "m1", entity_task_id: "t1" };
    expect(deepestEntity(row)).toBe("task");
    expect(resolveNotificationTarget(row, { role: "super_admin" })).toEqual({
      href: "/admin/ventures/v-uuid/tasks", entity: "task", surface: "staff",
    });
    expect(resolveNotificationTarget(row, { role: "founder" })).toEqual({
      href: "/participant/ventures/v-uuid/journey", entity: "task", surface: "member",
    });
  });

  test("venture-only and session rows resolve; legacy rows degrade to null href", () => {
    expect(resolveNotificationTarget({ entity_venture_id: "v1" }, { role: "founder" }).href).toBe("/participant/ventures/v1");
    expect(resolveNotificationTarget({ entity_venture_id: "v1", entity_session_id: "s9" }, { role: "staff" }).href).toBe("/admin/ventures/v1/sessions");
    const legacy = resolveNotificationTarget({ id: 5, title: "old" }, { role: "super_admin" });
    expect(legacy.href).toBeNull();
    expect(legacy.surface).toBeNull();
  });
});

describe("GET /api/notifications — seen lifecycle", () => {
  test("fetching the inbox marks returned rows as seen (seen_at), not read", async () => {
    const res = await GET(new Request("http://localhost/api/notifications"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.notifications.length).toBe(2);
    const seenUpdate = executed.find((q) => q.sql.includes("SET seen_at = COALESCE(seen_at, NOW())"));
    expect(seenUpdate).toBeDefined();
    expect(seenUpdate.sql).toContain("seen_at IS NULL");
    expect(seenUpdate.args).toEqual([1, 2]);
    // No read_at write on GET — read stays a separate user action.
    expect(executed.some((q) => q.sql.includes("is_read = 1"))).toBe(false);
  });
});
