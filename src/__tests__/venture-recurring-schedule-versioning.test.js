/**
 * P1 — schedule versions and listing (service level, no database).
 *
 * These guarantee the two promises the brief makes about change:
 *   • "modify from here on" ends the previous version the day before the new one
 *     starts, and links the chain (version N+1, supersedes_id = previous);
 *   • a replacement may not start on or before the version it replaces.
 */

jest.mock("@/services/ventures/schema", () => ({ ensureVentureSchema: jest.fn(async () => true) }));
jest.mock("@/models/ventureIdentityStore", () => ({ resolveVentureInternalId: jest.fn(async (ref) => ref) }));
jest.mock("@/models/ventureSessionSchedulesStore", () => ({
  selectScheduleById: jest.fn(),
  selectSchedulesByVenture: jest.fn(),
  insertScheduleRow: jest.fn(),
  closeScheduleRow: jest.fn(),
  setScheduleStatusRow: jest.fn(),
  selectScheduleExceptions: jest.fn(),
}));

const store = require("@/models/ventureSessionSchedulesStore");
const { createSchedule, createScheduleVersion, listSchedules } = require("@/services/ventures/recurringSchedules");

const PATTERN = {
  title: "Weekly coaching",
  session_type: "coaching",
  timezone: "Africa/Porto-Novo",
  frequency: "weekly",
  interval_count: 1,
  slots: [
    { weekday: 2, start: "16:00", minutes: 30 },
    { weekday: 5, start: "15:00", minutes: 30 },
  ],
  valid_from: "2026-11-03",
};

const PREVIOUS = {
  id: 7,
  venture_id: "VNT-1",
  title: "Weekly coaching",
  description: null,
  session_type: "coaching",
  timezone: "Africa/Porto-Novo",
  frequency: "weekly",
  interval_count: 1,
  slots: [
    { weekday: 2, start: "16:00", minutes: 30 },
    { weekday: 5, start: "15:00", minutes: 30 },
  ],
  valid_from: "2026-11-03",
  valid_until: null,
  max_occurrences: null,
  status: "draft",
  staff_cid: null,
  staff_name: null,
  milestone_ref: null,
  version: 1,
  supersedes_id: null,
  created_by: "USR_1",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  store.selectScheduleById.mockResolvedValue({ rows: [{ ...PREVIOUS }] });
  store.closeScheduleRow.mockResolvedValue({ rows: [{ ...PREVIOUS, status: "ended" }] });
  store.insertScheduleRow.mockImplementation(async ({ schedule, status, version, supersedesId }) => ({
    rows: [{ ...PREVIOUS, ...schedule, status, version, supersedes_id: supersedesId }],
  }));
  store.selectScheduleExceptions.mockResolvedValue({ rows: [] });
});

describe("creating a schedule", () => {
  test("it is stored as a DRAFT — P1 books nothing", async () => {
    const result = await createSchedule({ ventureRef: "VNT-1", input: PATTERN, actorCid: "USR_1" });

    expect(result.errors).toBeUndefined();
    expect(result.schedule.status).toBe("draft");
    expect(store.insertScheduleRow).toHaveBeenCalledWith(
      expect.objectContaining({ ventureId: "VNT-1", status: "draft" }),
    );
  });

  test("an invalid pattern writes nothing", async () => {
    const result = await createSchedule({ ventureRef: "VNT-1", input: { ...PATTERN, title: "" } });
    expect(result.errors).toContain("venture.schedule.error.title");
    expect(store.insertScheduleRow).not.toHaveBeenCalled();
  });
});

describe("modify from here on — a new version", () => {
  test("the previous version is ended the day before, and the chain is linked", async () => {
    const result = await createScheduleVersion({
      ventureRef: "VNT-1",
      scheduleId: 7,
      input: { ...PATTERN, valid_from: "2026-12-01", slots: [{ weekday: 4, start: "10:00", minutes: 45 }] },
      actorCid: "USR_2",
    });

    // History preserved: the old rule stops on 30 November, it is not rewritten.
    expect(store.closeScheduleRow).toHaveBeenCalledWith(7, "2026-11-30");
    expect(store.insertScheduleRow).toHaveBeenCalledWith(
      expect.objectContaining({ version: 2, supersedesId: 7, status: "draft" }),
    );
    expect(result.schedule.version).toBe(2);
  });

  test("a replacement cannot start on or before the version it replaces", async () => {
    const result = await createScheduleVersion({
      ventureRef: "VNT-1",
      scheduleId: 7,
      input: { ...PATTERN, valid_from: "2026-11-03" },
    });

    expect(result.errors).toContain("venture.schedule.error.versionFrom");
    expect(store.closeScheduleRow).not.toHaveBeenCalled();
    expect(store.insertScheduleRow).not.toHaveBeenCalled();
  });

  test("an ended schedule cannot be versioned", async () => {
    store.selectScheduleById.mockResolvedValue({ rows: [{ ...PREVIOUS, status: "ended" }] });
    const result = await createScheduleVersion({
      ventureRef: "VNT-1",
      scheduleId: 7,
      input: { ...PATTERN, valid_from: "2026-12-01" },
    });
    expect(result.errors).toContain("venture.schedule.error.ended");
  });
});

describe("listing", () => {
  test("a live schedule comes back with its next occurrences, and nothing is written", async () => {
    store.selectSchedulesByVenture.mockResolvedValue({ rows: [{ ...PREVIOUS }] });

    const result = await listSchedules({ ventureRef: "VNT-1", previewLimit: 3 });

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].next).toHaveLength(3);
    expect(result.schedules[0].next.every((occurrence) => occurrence.status === "planned")).toBe(true);
    expect(store.insertScheduleRow).not.toHaveBeenCalled();
    expect(store.closeScheduleRow).not.toHaveBeenCalled();
  });

  test("an ended schedule lists no upcoming occurrences", async () => {
    store.selectSchedulesByVenture.mockResolvedValue({ rows: [{ ...PREVIOUS, status: "ended" }] });
    const result = await listSchedules({ ventureRef: "VNT-1" });
    expect(result.schedules[0].next).toEqual([]);
  });
});
