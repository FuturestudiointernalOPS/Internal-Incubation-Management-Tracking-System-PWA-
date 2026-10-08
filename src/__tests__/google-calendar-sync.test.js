/**
 * Google Calendar sync — the pure rules and the token vault.
 *
 * What matters most here: our own task copies are recognised (so they are never
 * imported back as "events"), a task becomes exactly one all-day event with the
 * right exclusive end date, unchanged tasks cause no Google call, and refresh
 * tokens round-trip through AES-256-GCM but cannot be read or forged without the key.
 */
import {
  addDays,
  isPlatformEvent,
  normalizeGoogleEvent,
  planTaskSync,
  taskToGoogleEvent,
  toDashboardItem,
} from "@/services/integrations/googleCalendar/mapping";
import {
  decryptToken,
  encryptToken,
  isTokenEncryptionConfigured,
} from "@/lib/integrations/google/tokenCrypto";

const task = (overrides = {}) => ({
  id: 7,
  title: "Prepare demo day",
  status: "in_progress",
  priority: "high",
  start_day: "2026-10-08",
  end_day: "2026-10-10",
  ...overrides,
});

describe("addDays", () => {
  it("crosses month and year boundaries without timezone drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("taskToGoogleEvent", () => {
  it("makes an all-day event whose end is exclusive (+1 day)", () => {
    const body = taskToGoogleEvent(task(), { appUrl: "https://app.test" });
    expect(body.start).toEqual({ date: "2026-10-08" });
    expect(body.end).toEqual({ date: "2026-10-11" });
    expect(body.summary).toBe("Prepare demo day");
    expect(body.extendedProperties.private).toEqual({ fs_source: "impactos", fs_task_id: "7" });
    expect(body.description).toContain("https://app.test/admin/tasks");
  });

  it("uses the single known date when only one is set", () => {
    expect(taskToGoogleEvent(task({ start_day: null })).start).toEqual({ date: "2026-10-10" });
    expect(taskToGoogleEvent(task({ end_day: null })).end).toEqual({ date: "2026-10-09" });
  });

  it("marks a finished task and skips a task without dates", () => {
    expect(taskToGoogleEvent(task({ status: "completed" })).summary).toBe("✓ Prepare demo day");
    expect(taskToGoogleEvent(task({ start_day: null, end_day: null }))).toBeNull();
  });

  it("never ends before it starts", () => {
    const body = taskToGoogleEvent(task({ start_day: "2026-10-10", end_day: "2026-10-08" }));
    expect(body.end).toEqual({ date: "2026-10-11" });
  });
});

describe("planTaskSync", () => {
  it("creates new tasks, updates changed ones, deletes vanished ones, leaves the rest", () => {
    const unchanged = task({ id: 1 });
    const first = planTaskSync([unchanged], []);
    const fingerprint = first.creates[0].fingerprint;

    const plan = planTaskSync(
      [unchanged, task({ id: 2, title: "Renamed" }), task({ id: 3 })],
      [
        { task_id: 1, google_event_id: "e1", fingerprint },
        { task_id: 2, google_event_id: "e2", fingerprint: "old" },
        { task_id: 9, google_event_id: "e9", fingerprint: "x" },
      ],
    );
    expect(plan.creates.map((entry) => entry.task.id)).toEqual([3]);
    expect(plan.updates.map((entry) => entry.eventId)).toEqual(["e2"]);
    expect(plan.deletes).toEqual([{ taskId: 9, eventId: "e9" }]);
  });
});

describe("reading Google back", () => {
  it("recognises the platform's own copies", () => {
    expect(isPlatformEvent(taskToGoogleEvent(task()))).toBe(true);
    expect(isPlatformEvent({ summary: "Investor call" })).toBe(false);
  });

  it("turns an all-day event into an inclusive range", () => {
    const row = normalizeGoogleEvent({
      id: "abc",
      summary: "Board meeting",
      start: { date: "2026-10-12" },
      end: { date: "2026-10-14" },
      htmlLink: "https://calendar.google.com/event?eid=abc",
    });
    expect(row).toMatchObject({ startDate: "2026-10-12", endDate: "2026-10-13", allDay: true });
  });

  it("keeps the local day of a timed event", () => {
    const row = normalizeGoogleEvent({
      id: "t1",
      summary: "Standup",
      start: { dateTime: "2026-10-12T09:00:00+01:00" },
      end: { dateTime: "2026-10-12T09:30:00+01:00" },
    });
    expect(row).toMatchObject({ startDate: "2026-10-12", endDate: "2026-10-12", allDay: false });
  });

  it("ignores an event without a date", () => {
    expect(normalizeGoogleEvent({ id: "x", start: {} })).toBeNull();
  });

  it("shapes a stored event like a dashboard calendar entry", () => {
    const item = toDashboardItem({
      google_event_id: "abc",
      title: "Board meeting",
      all_day: true,
      start_day: "2026-10-12",
      end_day: "2026-10-13",
      html_link: "https://calendar.google.com/x",
    });
    expect(item).toMatchObject({
      id: "gcal-abc",
      source: "google",
      start_date: "2026-10-12",
      end_date: "2026-10-13",
      html_link: "https://calendar.google.com/x",
    });
  });
});

describe("token vault (AES-256-GCM)", () => {
  const original = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });
  afterAll(() => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = original;
  });

  it("round-trips and never stores the clear value", () => {
    const stored = encryptToken("1//refresh-token");
    expect(stored).not.toContain("refresh-token");
    expect(stored.startsWith("v1:")).toBe(true);
    expect(decryptToken(stored)).toBe("1//refresh-token");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("rejects a tampered ciphertext", () => {
    const [version, iv, tag, data] = encryptToken("secret").split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => decryptToken([version, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
  });

  it("refuses to work without a 32-byte key", () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "too-short";
    expect(isTokenEncryptionConfigured()).toBe(false);
    expect(() => encryptToken("x")).toThrow(/GOOGLE_TOKEN_ENCRYPTION_KEY/);
  });
});
