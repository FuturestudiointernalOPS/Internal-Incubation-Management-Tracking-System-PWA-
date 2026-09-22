/**
 * THE BELL'S UNREAD BADGE IS A COUNT, AND IT STAYS CURRENT.
 *
 * Two defects this locks shut:
 *   1. The badge was the LENGTH of a page of rows (the 50 most recent), so a big
 *      inbox under-reported and the number could only move when those rows were
 *      read. It is now the server's own COUNT of unread rows.
 *   2. The shell asked once, so the number froze for the whole session — reading
 *      a notification anywhere left the bell claiming the old total. The shell
 *      now polls and re-asks when the tab returns to the foreground.
 *
 * The bell panel is also a GLANCE: it lists a few rows, not the whole inbox.
 */

const fs = require("fs");
const path = require("path");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

// ── The read: a COUNT that is independent of the list it ships beside ──
const UNREAD_TOTAL = 7;
const LIST_ROWS = [
  { id: 1, is_read: 0, title: "A" },
  { id: 2, is_read: 0, title: "B" },
];

const mockDb = {
  execute: jest.fn(async ({ sql }) => {
    if (String(sql).includes("COUNT(*)") && String(sql).includes("v2_notifications")) {
      return { rows: [{ c: UNREAD_TOTAL }] };
    }
    return { rows: LIST_ROWS };
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

const { GET } = require("@/app/api/notifications/route");

describe("GET /api/notifications — the badge is a COUNT, not the page length", () => {
  test("unread_count counts every unread row, not just the rows returned", async () => {
    const res = await GET(new Request("http://localhost/api/notifications"));
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.notifications.length).toBe(2);
    // The number the bell shows is the COUNT — deliberately larger than the
    // page of rows, which is exactly the case a list-derived badge got wrong.
    expect(data.unread_count).toBe(UNREAD_TOTAL);
    expect(data.unread_count).not.toBe(data.notifications.length);
  });
});

// ── The shell: it obeys that number, limits the panel, and keeps it fresh ──
const SHELL = "src/components/layout/DashboardLayout.js";

describe("the bell — a glance, on a live number", () => {
  const src = read(SHELL);

  test("the badge takes the server's count", () => {
    expect(src).toMatch(/data\.unread_count/);
    expect(src).toMatch(/typeof data\.unread_count === "number"/);
  });

  test("the panel shows only a few unread rows at a time", () => {
    expect(src).toMatch(/NOTIFICATIONS_PREVIEW = 3/);
    expect(src).toMatch(/notifications\.slice\(0, NOTIFICATIONS_PREVIEW\)/);
  });

  test("the badge is re-asked on a timer and when the tab comes back", () => {
    expect(src).toMatch(/setInterval\(fetchNotifications/);
    expect(src).toMatch(/visibilitychange/);
  });

  test("opening the panel re-asks, so list and badge agree", () => {
    expect(src).toMatch(/if \(!showNotifications\) fetchNotifications\(\)/);
  });
});
