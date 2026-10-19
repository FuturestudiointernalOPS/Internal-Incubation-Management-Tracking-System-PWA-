/**
 * pushSessionToCalendars — a session write reaches the calendars it concerns.
 *
 * The rule this locks: booking (and every later change) syncs the people
 * closest to the session — the booker and the coach — and nothing about that
 * sync may ever fail the write that triggered it.
 */

const mockSyncUser = jest.fn(async () => ({ ok: true }));

jest.mock("@/services/integrations/googleCalendar", () => ({
  syncUser: (...args) => mockSyncUser(...args),
}));

const { pushSessionToCalendars } = require("@/services/ventures/sessionCalendarPush");

beforeEach(() => {
  mockSyncUser.mockClear();
  mockSyncUser.mockResolvedValue({ ok: true });
});

describe("who is synced", () => {
  test("the booker and the coach both get the session", async () => {
    const result = await pushSessionToCalendars(["USR_BOOKER", "USR_COACH"]);
    expect(result).toEqual({ attempted: 2 });
    expect(mockSyncUser).toHaveBeenCalledTimes(2);
    expect(mockSyncUser).toHaveBeenCalledWith("USR_BOOKER");
    expect(mockSyncUser).toHaveBeenCalledWith("USR_COACH");
  });

  test("a booker who is also the coach syncs once", async () => {
    await pushSessionToCalendars(["USR_BOTH", "USR_BOTH"]);
    expect(mockSyncUser).toHaveBeenCalledTimes(1);
  });

  test("no coach (nobody assigned) syncs just the booker", async () => {
    await pushSessionToCalendars(["USR_BOOKER", null, undefined, ""]);
    expect(mockSyncUser).toHaveBeenCalledTimes(1);
    expect(mockSyncUser).toHaveBeenCalledWith("USR_BOOKER");
  });

  test("nothing to sync is not an error", async () => {
    expect(await pushSessionToCalendars([])).toEqual({ attempted: 0 });
    expect(await pushSessionToCalendars(null)).toEqual({ attempted: 0 });
    expect(mockSyncUser).not.toHaveBeenCalled();
  });

  test("a cid with surrounding space is the same person", async () => {
    await pushSessionToCalendars([" USR_A ", "USR_A"]);
    expect(mockSyncUser).toHaveBeenCalledTimes(1);
    expect(mockSyncUser).toHaveBeenCalledWith("USR_A");
  });
});

describe("a calendar never breaks the write that triggered it", () => {
  test("one person's failure does not stop the others", async () => {
    mockSyncUser.mockImplementationOnce(async () => {
      throw new Error("invalid_grant");
    });
    const result = await pushSessionToCalendars(["USR_FAILS", "USR_OK"]);
    expect(result).toEqual({ attempted: 1 });
    expect(mockSyncUser).toHaveBeenCalledTimes(2);
  });

  test("everyone failing still resolves — never throws", async () => {
    mockSyncUser.mockImplementation(async () => {
      throw new Error("Google is unreachable");
    });
    await expect(pushSessionToCalendars(["USR_A", "USR_B"])).resolves.toEqual({
      attempted: 0,
    });
  });

  test("an unconnected person (notConnected) is not a failure", async () => {
    mockSyncUser.mockResolvedValue({ ok: false, error: "notConnected" });
    await expect(pushSessionToCalendars(["USR_A"])).resolves.toEqual({
      attempted: 1,
    });
  });
});
