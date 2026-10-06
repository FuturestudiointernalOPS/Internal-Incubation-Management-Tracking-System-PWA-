/**
 * The reminder sweep endpoint — the one thing that makes a reminder automatic.
 *
 * It sends real mail to real people, so the credential rules are the point of
 * this file: an unconfigured deployment must NOT become an open send button, a
 * wrong secret must never be rescued by a fallback, and the secret that works is
 * this job's own — not one borrowed from an older sweep.
 */
jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => ({})) }));

const mockSweep = jest.fn(async () => ({ today: "2026-10-09", ventures: [], sent: 0, skipped: 0, failed: 0, no_recipients: 0 }));
jest.mock("@/services/reminders/sweep", () => ({
  runReminderSweep: (...args) => mockSweep(...args),
}));

const ORIGINAL = { CRON_SECRET: process.env.CRON_SECRET, REMINDERS_SECRET_KEY: process.env.REMINDERS_SECRET_KEY };

function post({ headers = {}, url = "http://localhost/api/reminders/sweep" } = {}) {
  const route = require("@/app/api/reminders/sweep/route");
  return route.POST(new Request(url, { method: "POST", headers }));
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CRON_SECRET;
  delete process.env.REMINDERS_SECRET_KEY;
});

afterAll(() => {
  if (ORIGINAL.CRON_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL.CRON_SECRET;
  if (ORIGINAL.REMINDERS_SECRET_KEY === undefined) delete process.env.REMINDERS_SECRET_KEY;
  else process.env.REMINDERS_SECRET_KEY = ORIGINAL.REMINDERS_SECRET_KEY;
});

describe("the credential", () => {
  test("an unconfigured deployment refuses and sends nothing", async () => {
    const response = await post({ headers: { "x-cron-secret": "anything" } });

    expect(response.status).toBe(503);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  test("no secret presented is refused", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await post();

    expect(response.status).toBe(403);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  test("a wrong secret is refused", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await post({ headers: { "x-cron-secret": "not-it" } });

    expect(response.status).toBe(403);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  test("a wrong HEADER is not rescued by a right query parameter", async () => {
    // The caller chose to present that value; it stands.
    process.env.CRON_SECRET = "s3cret";
    const response = await post({
      headers: { "x-cron-secret": "wrong" },
      url: "http://localhost/api/reminders/sweep?key=s3cret",
    });

    expect(response.status).toBe(403);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  test("the right secret sweeps", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await post({ headers: { "x-cron-secret": "s3cret" } });

    expect(response.status).toBe(200);
    expect(mockSweep).toHaveBeenCalled();
  });

  test("its own secret works — the job does not borrow an older one", async () => {
    process.env.REMINDERS_SECRET_KEY = "reminders-only";
    const response = await post({ headers: { "x-cron-secret": "reminders-only" } });

    expect(response.status).toBe(200);
  });

  test("the deprecated query parameter still works with no header", async () => {
    process.env.CRON_SECRET = "s3cret";
    const response = await post({ url: "http://localhost/api/reminders/sweep?key=s3cret" });

    expect(response.status).toBe(200);
  });
});

describe("what it sweeps", () => {
  test("with no Venture named, every Venture with rules", async () => {
    process.env.CRON_SECRET = "s3cret";
    await post({ headers: { "x-cron-secret": "s3cret" } });

    expect(mockSweep).toHaveBeenCalledWith({ ventureCode: null });
  });

  test("?venture= sweeps just that one — how a rule is tested without waiting a day", async () => {
    process.env.CRON_SECRET = "s3cret";
    await post({
      headers: { "x-cron-secret": "s3cret" },
      url: "http://localhost/api/reminders/sweep?venture=VNT-KORA",
    });

    expect(mockSweep).toHaveBeenCalledWith({ ventureCode: "VNT-KORA" });
  });

  test("the report is returned whole, so a run can be read without the logs", async () => {
    process.env.CRON_SECRET = "s3cret";
    mockSweep.mockResolvedValue({ today: "2026-10-09", ventures: [{ venture: "VNT-KORA", sent: 2 }], sent: 2, skipped: 1, failed: 0, no_recipients: 0 });

    const body = await (await post({ headers: { "x-cron-secret": "s3cret" } })).json();

    expect(body.success).toBe(true);
    expect(body.today).toBe("2026-10-09");
    expect(body.sent).toBe(2);
    expect(body.ventures[0].venture).toBe("VNT-KORA");
  });

  test("running it twice is safe — the second run reports what it skipped", async () => {
    process.env.CRON_SECRET = "s3cret";
    mockSweep.mockResolvedValue({ today: "2026-10-09", ventures: [], sent: 0, skipped: 3, failed: 0, no_recipients: 0 });

    const body = await (await post({ headers: { "x-cron-secret": "s3cret" } })).json();

    expect(body.sent).toBe(0);
    expect(body.skipped).toBe(3);
  });
});
