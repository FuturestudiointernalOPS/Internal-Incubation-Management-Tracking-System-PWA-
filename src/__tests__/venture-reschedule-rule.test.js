/**
 * Contract tests — reschedule scheduling floor (Vinance 3, item A1).
 *
 * rescheduleSession must apply the same floor that guards booking, after the
 * session lookup and before the double-booking check:
 *   - a parseable start and end
 *   - an end strictly after the start
 *   - a start that has not already passed (any lead time is allowed)
 *
 * The db double answers the session lookup with one row and every
 * double-booking probe with none, and records each { sql, args } pair so the
 * valid case can assert the UPDATE it must run.
 */

const executed = [];

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT * FROM venture_sessions WHERE id = ?")) {
      return { rows: [{ id: 7, venture_id: "VNT-TEST", coach_id: null }] };
    }
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

const { rescheduleSession } = require("@/services/ventures/sessions");
const { SESSION_PAST_START_ERROR } = require("@/lib/ventureSessionRules");

const SESSION_ID = 7;
const HOUR = 60 * 60 * 1000;
const PAST_MESSAGE = SESSION_PAST_START_ERROR;

// 2099 so the valid window can never fall inside the lead floor.
const VALID_START = new Date(Date.UTC(2099, 0, 1, 12, 0, 0));
const VALID_END = new Date(VALID_START.getTime() + HOUR);

const updateQuery = () => executed.find((entry) => entry.sql.includes("UPDATE venture_sessions SET start_time"));

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
});

describe("rescheduleSession — scheduling floor", () => {
  test("a start time in the past is refused", async () => {
    await expect(
      rescheduleSession(SESSION_ID, "2000-01-01T00:00:00.000Z", "2000-01-01T01:00:00.000Z"),
    ).rejects.toThrow(PAST_MESSAGE);
    expect(updateQuery()).toBeUndefined();
  });

  test("a start time minutes from now is allowed — there is no lead time", async () => {
    // A 30-minute floor used to make this impossible, which is not what the
    // person rescheduling the session wanted.
    const start = new Date(Date.now() + 5 * 60 * 1000);
    const end = new Date(start.getTime() + HOUR);
    const res = await rescheduleSession(SESSION_ID, start.toISOString(), end.toISOString());
    expect(res).toEqual({ success: true });
    expect(updateQuery()).toBeDefined();
  });

  test("an end time before the start time is refused", async () => {
    const end = new Date(VALID_START.getTime() - HOUR);
    await expect(rescheduleSession(SESSION_ID, VALID_START.toISOString(), end.toISOString())).rejects.toThrow(
      "End time must be after start time.",
    );
    expect(updateQuery()).toBeUndefined();
  });

  test("an unparseable date is refused", async () => {
    await expect(rescheduleSession(SESSION_ID, "not-a-date", VALID_END.toISOString())).rejects.toThrow(
      "A session date and time are required.",
    );
    expect(updateQuery()).toBeUndefined();
  });

  test("a valid window with no clash is applied and marked rescheduled", async () => {
    const res = await rescheduleSession(SESSION_ID, VALID_START.toISOString(), VALID_END.toISOString());
    expect(res).toEqual({ success: true });
    const update = updateQuery();
    expect(update).toBeDefined();
    expect(update.sql).toContain("status = 'rescheduled'");
    expect(update.args).toEqual([VALID_START.toISOString(), VALID_END.toISOString(), SESSION_ID]);
  });
});
