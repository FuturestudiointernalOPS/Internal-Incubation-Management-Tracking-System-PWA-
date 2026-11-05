/**
 * PHASE 3a — the evidence layer.
 *
 * Pure rules for the event log (spec §7, §4.4) and for interview evidence, plus
 * the write paths against an in-memory fake. No database is touched.
 */

const mockState = { bands: [], inserted: [], count: 0 };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(), transaction: jest.fn() },
}));

jest.mock("@/services/ventures/schema", () => ({
  ensureVentureSchema: jest.fn(async () => {}),
}));

jest.mock("@/services/ventures/reporting/settings", () => ({
  ensureReportingSchema: jest.fn(async () => {}),
  getReportingSettings: jest.fn(async () => ({
    settings: { validation_min_interviews: 10 },
    bands: { flow: [], cash: [] },
    glossary: [],
  })),
}));

jest.mock("@/models/ventureReportingStore", () => ({
  runInTransaction: jest.fn(async (fn) => fn(jest.fn())),
  selectBands: jest.fn(async () => ({ rows: mockState.bands })),
  // `listEvents` reads the Venture's currency to label amounts recorded before
  // the currency was stamped on the row. An absent profile is the XOF default.
  selectCurrentProfile: jest.fn(async () => ({ rows: [{ reporting_currency: "XOF" }] })),
  selectEvents: jest.fn(async () => ({ rows: [] })),
  insertEvent: jest.fn(async (_query, event) => {
    const row = {
      id: "event-1",
      event_type: event.eventType,
      event_date: event.eventDate,
      title: event.title,
      description: event.description,
      customer_name: event.customerName,
      amount_mode: event.amountMode,
      amount_value: event.amountValue,
      amount_band: event.amountBand,
      financing_type: event.financingType,
      source: event.source,
      market_description: event.marketDescription,
      status_from: event.statusFrom,
      status_to: event.statusTo,
      evidence: event.evidence,
      evidence_name: event.evidenceName,
      created_at: new Date(),
    };
    mockState.inserted.push(row);
    return { rows: [row] };
  }),
  softDeleteEvent: jest.fn(async () => ({ rows: [] })),
  selectInterviews: jest.fn(async () => ({ rows: [] })),
  insertInterview: jest.fn(async (_query, interview) => ({
    rows: [
      {
        id: "interview-1",
        interview_date: interview.interviewDate,
        customer_segment: interview.customerSegment,
        interviewee_name: interview.intervieweeName,
        notes: interview.notes,
        insights: interview.insights,
        evidence: interview.evidence,
        evidence_name: interview.evidenceName,
        created_at: new Date(),
      },
    ],
  })),
  countEvidenceBackedInterviews: jest.fn(async () => ({ rows: [{ total: mockState.count }] })),
}));

const {
  validateEvent,
  eventRowValues,
  isValidEvidenceValue,
  isValidEventDate,
  EVENT_TYPES,
} = require("@/services/ventures/reporting/eventRules");
const {
  createEvent,
  listEvents,
  deleteEvent,
  createInterview,
  interviewSummary,
} = require("@/services/ventures/reporting/events");

const BAND_ROWS = [
  { band_kind: "flow", band_code: "F1", sort_order: 1, low: 1, high: 50000, midpoint: 25000.5 },
];

const BANDS = { flow: [{ code: "F1", low: 1, high: 50000, midpoint: 25000.5 }], cash: [] };

const TODAY = new Date("2026-11-03T12:00:00Z");

const pilot = (overrides = {}) => ({
  eventType: "pilot_signed",
  eventDate: "2026-10-01",
  customerName: "Acme",
  evidence: "https://example.com/signed-pilot.pdf",
  ...overrides,
});

beforeEach(() => {
  mockState.bands = BAND_ROWS;
  mockState.inserted = [];
  mockState.count = 0;
});

// ── Event types ────────────────────────────────────────────────────────────

describe("event vocabulary", () => {
  test("six events a founder may record", () => {
    expect(EVENT_TYPES).toEqual([
      "pilot_signed",
      "mvp_launched",
      "pilot_converted",
      "financing_received",
      "new_market",
      "status_change",
    ]);
  });

  test("a stage change is not a founder event", () => {
    const errors = validateEvent({ eventType: "stage_change", eventDate: "2026-10-01" }, { bands: BANDS, now: TODAY });
    expect(errors).toEqual(["venture.reporting.events.validation.type"]);
  });

  test("an unknown type is refused, not stored", () => {
    const errors = validateEvent({ eventType: "raised_a_round", eventDate: "2026-10-01" }, { bands: BANDS, now: TODAY });
    expect(errors).toContain("venture.reporting.events.validation.type");
  });
});

// ── Evidence rules (spec §4.4) ─────────────────────────────────────────────

describe("evidence rules", () => {
  test("a signed pilot needs a document or a link", () => {
    expect(validateEvent(pilot(), { bands: BANDS, now: TODAY })).toEqual([]);
    expect(validateEvent(pilot({ evidence: "" }), { bands: BANDS, now: TODAY })).toContain(
      "venture.reporting.events.validation.evidenceRequired",
    );
  });

  test("an MVP launch needs evidence", () => {
    expect(
      validateEvent({ eventType: "mvp_launched", eventDate: "2026-10-01" }, { bands: BANDS, now: TODAY }),
    ).toContain("venture.reporting.events.validation.evidenceRequired");
  });

  test("a converted pilot needs no document — the monthly numbers prove it", () => {
    expect(
      validateEvent(
        { eventType: "pilot_converted", eventDate: "2026-10-01", customerName: "Acme" },
        { bands: BANDS, now: TODAY },
      ),
    ).toEqual([]);
  });

  test("a new market needs a description AND evidence", () => {
    const errors = validateEvent(
      { eventType: "new_market", eventDate: "2026-10-01" },
      { bands: BANDS, now: TODAY },
    );
    expect(errors).toContain("venture.reporting.events.validation.market");
    expect(errors).toContain("venture.reporting.events.validation.evidenceRequired");
  });

  test("a storage path is accepted as evidence, a script URL is not", () => {
    expect(isValidEvidenceValue("deliverables/VNT-1/reporting-pilot/x.pdf")).toBe(true);
    expect(isValidEvidenceValue("https://example.com/x.pdf")).toBe(true);
    expect(isValidEvidenceValue("javascript:alert(1)")).toBe(false);
    expect(isValidEvidenceValue("file:///etc/passwd")).toBe(false);
  });
});

// ── Dates ──────────────────────────────────────────────────────────────────

describe("event dates", () => {
  test("a real past date is accepted", () => {
    expect(isValidEventDate("2026-10-01", TODAY)).toBe(true);
  });

  test("the future is refused", () => {
    expect(isValidEventDate("2027-01-01", TODAY)).toBe(false);
  });

  test("nonsense is refused", () => {
    expect(isValidEventDate("01/10/2026", TODAY)).toBe(false);
    expect(isValidEventDate("2026-02-31", TODAY)).toBe(false);
  });
});

// ── Financing ──────────────────────────────────────────────────────────────

describe("financing events", () => {
  test("an exact amount and a type are required", () => {
    const errors = validateEvent(
      { eventType: "financing_received", eventDate: "2026-10-01" },
      { bands: BANDS, now: TODAY },
    );
    expect(errors).toContain("venture.reporting.events.validation.amount");
    expect(errors).toContain("venture.reporting.events.validation.financingType");
  });

  test("a band is refused, whether or not the studio publishes it", () => {
    const known = validateEvent(
      {
        eventType: "financing_received",
        eventDate: "2026-10-01",
        amountMode: "band",
        amountBand: "F1",
        financingType: "grant",
      },
      { now: TODAY },
    );
    expect(known).toContain("venture.reporting.validation.bandRemoved");

    const unknown = validateEvent(
      {
        eventType: "financing_received",
        eventDate: "2026-10-01",
        amountMode: "band",
        amountBand: "F9",
        financingType: "grant",
      },
      { now: TODAY },
    );
    expect(unknown).toContain("venture.reporting.validation.bandRemoved");
  });

  test("the row keeps the mode it was answered in", () => {
    const values = eventRowValues({
      input: {
        eventType: "financing_received",
        eventDate: "2026-10-01",
        amountMode: "band",
        amountBand: "F1",
        financingType: "grant",
        amountValue: 999,
      },
    });
    expect(values.amountMode).toBe("band");
    expect(values.amountBand).toBe("F1");
    expect(values.amountValue).toBeNull();
  });
});

// ── Status change ──────────────────────────────────────────────────────────

describe("status change", () => {
  test("only the four lifecycle statuses are accepted", () => {
    expect(
      validateEvent(
        { eventType: "status_change", eventDate: "2026-10-01", statusTo: "dormant" },
        { bands: BANDS, now: TODAY },
      ),
    ).toEqual([]);

    expect(
      validateEvent(
        { eventType: "status_change", eventDate: "2026-10-01", statusTo: "bankrupt" },
        { bands: BANDS, now: TODAY },
      ),
    ).toContain("venture.reporting.events.validation.status");
  });
});

// ── Write paths ────────────────────────────────────────────────────────────

describe("event write path", () => {
  const VENTURE = { ventureUuid: "11111111-1111-1111-1111-111111111111", ventureCode: "VNT-TEST" };

  test("a valid event is stored and shaped back", async () => {
    const result = await createEvent({ ...VENTURE, actorCid: "C1", input: pilot() });
    expect(result.errors).toBeUndefined();
    expect(result.event.type).toBe("pilot_signed");
    expect(result.event.date).toBe("2026-10-01");
    expect(result.event.evidenceIsLink).toBe(true);
    expect(mockState.inserted).toHaveLength(1);
  });

  test("an invalid event writes nothing", async () => {
    const result = await createEvent({ ...VENTURE, actorCid: "C1", input: pilot({ evidence: "" }) });
    expect(result.errors).toContain("venture.reporting.events.validation.evidenceRequired");
    expect(mockState.inserted).toHaveLength(0);
  });

  test("deleting without an id is refused", async () => {
    const result = await deleteEvent({ ...VENTURE, id: null, actorCid: "C1" });
    expect(result.errors).toContain("venture.reporting.events.validation.id");
  });

  test("an empty log is an answer, not an error", async () => {
    const result = await listEvents({ ventureUuid: VENTURE.ventureUuid });
    expect(result.events).toEqual([]);
  });
});

describe("interview evidence", () => {
  const VENTURE = { ventureUuid: "11111111-1111-1111-1111-111111111111" };

  test("an interview requires evidence", async () => {
    const result = await createInterview({
      ...VENTURE,
      actorCid: "C1",
      input: { interviewDate: "2026-10-01", evidence: "" },
    });
    expect(result.errors).toContain("venture.reporting.interviews.validation.evidenceRequired");
  });

  test("a document path is accepted", async () => {
    const result = await createInterview({
      ...VENTURE,
      actorCid: "C1",
      input: {
        interviewDate: "2026-10-01",
        evidence: "deliverables/VNT-1/reporting-interview/notes.pdf",
        evidenceName: "notes.pdf",
      },
    });
    expect(result.errors).toBeUndefined();
    expect(result.interview.evidenceIsLink).toBe(false);
    expect(result.interview.evidenceName).toBe("notes.pdf");
  });

  test("the summary compares the count with the studio's threshold", async () => {
    mockState.count = 7;
    const summary = await interviewSummary({ ventureUuid: VENTURE.ventureUuid });
    expect(summary).toEqual({ withEvidence: 7, minimum: 10, met: false });

    mockState.count = 10;
    const met = await interviewSummary({ ventureUuid: VENTURE.ventureUuid });
    expect(met.met).toBe(true);
  });
});
