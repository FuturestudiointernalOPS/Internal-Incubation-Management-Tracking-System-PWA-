/**
 * POOL FAILURE TRACKING IS A SLIDING WINDOW — src/lib/db.js
 *
 * Idle connections die sooner than the pool's own retire schedule, because an
 * intermediary on the way to the database closes them first. Each death is
 * invisible to users (the failed query is retried once), but the tracker that
 * decides whether to rebuild the whole pool used to be a lifetime tally: five
 * deaths spread over hours added up exactly like five simultaneous ones and
 * dropped every connection at once.
 *
 * These tests drive the real failure handler through a fake pool and pin the
 * contract that matters:
 *   - a close-together burst still triggers a rebuild,
 *   - a slow drift never accumulates to one,
 *   - failures older than the window are forgotten,
 *   - the log says how many recent failures a death is counted with.
 */

const mockQuery = jest.fn(async () => ({ rows: [], fields: [], rowCount: 0 }));
const mockEnd = jest.fn(async () => {});
const mockHandlers = {};

jest.mock("pg", () => ({
  __esModule: true,
  Pool: jest.fn(() => ({
    query: (...args) => mockQuery(...args),
    on: (event, handler) => {
      mockHandlers[event] = handler;
    },
    end: (...args) => mockEnd(...args),
  })),
}));

beforeEach(() => {
  mockQuery.mockClear();
  mockEnd.mockClear();
  for (const event of Object.keys(mockHandlers)) delete mockHandlers[event];
  jest.resetModules();
});

afterEach(() => {
  jest.useRealTimers();
});

async function freshDb() {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
  const dbModule = await import("@/lib/db");
  return dbModule.default;
}

/** Create the pool, then return the handler it registered for idle failures. */
async function idleFailureHandler() {
  const db = await freshDb();
  await db.execute({ sql: "SELECT 1", args: [] });
  return mockHandlers.error;
}

const fail = (onError) => onError(new Error("read ETIMEDOUT"));

describe("a burst of pool failures still rebuilds the pool", () => {
  test("five close-together idle deaths drop the pool once", async () => {
    jest.useFakeTimers();
    const onError = await idleFailureHandler();

    for (let i = 0; i < 5; i++) {
      fail(onError);
      jest.advanceTimersByTime(1000);
    }

    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});

describe("a slow drift of pool failures no longer rebuilds the pool", () => {
  test("deaths spread over hours do not accumulate", async () => {
    jest.useFakeTimers();
    const onError = await idleFailureHandler();

    for (let i = 0; i < 10; i++) {
      fail(onError);
      jest.advanceTimersByTime(30 * 60 * 1000); // half an hour apart
    }

    expect(mockEnd).not.toHaveBeenCalled();
  });

  test("failures older than the window are forgotten", async () => {
    jest.useFakeTimers();
    const onError = await idleFailureHandler();

    for (let i = 0; i < 4; i++) fail(onError); // a burst, just under the limit
    jest.advanceTimersByTime(60 * 60 * 1000); // long quiet period
    for (let i = 0; i < 4; i++) fail(onError); // a second burst, still under it

    expect(mockEnd).not.toHaveBeenCalled();
  });
});

describe("the log makes the window visible", () => {
  test("an idle death reports how many recent failures it is counted with", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const onError = await idleFailureHandler();

    fail(onError);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("1/5"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("in the last"));
    log.mockRestore();
  });
});
