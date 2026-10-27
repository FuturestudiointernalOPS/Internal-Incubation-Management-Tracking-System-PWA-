/**
 * CRM — time-based automation triggers.
 *
 * The engine already fires events on writes. These tests pin the clock around
 * it: which records are candidates, that a record no rule matches is not even
 * sent to the engine, the day-scoped event id (one run per record per day), and
 * the process throttle.
 */

jest.mock("@/models/crm/schema", () => ({
  ensureCrmStageTargetColumn: jest.fn(async () => {}),
}));
jest.mock("@/models/crm/intelligence", () => ({
  getActiveRulesByEvent: jest.fn(),
}));
jest.mock("@/models/crm/timeTriggers", () => ({
  getStaleLeadCandidates: jest.fn(),
  getStaleOpportunityCandidates: jest.fn(),
  getStuckOpportunityCandidates: jest.fn(),
}));
jest.mock("@/services/crm/automationEngine", () => ({
  fireCrmEvent: jest.fn(async () => {}),
  evaluateConditions: jest.fn(() => true),
}));

const { getActiveRulesByEvent } = require("@/models/crm/intelligence");
const {
  getStaleLeadCandidates,
  getStaleOpportunityCandidates,
  getStuckOpportunityCandidates,
} = require("@/models/crm/timeTriggers");
const { fireCrmEvent, evaluateConditions } = require("@/services/crm/automationEngine");
const {
  sweepCrmTimeTriggers,
  TIME_TRIGGER_SWEEP_INTERVAL_MS,
} = require("@/services/crm/timeTriggers");

const NOW = new Date("2026-10-13T12:00:00Z");
const RULE = { id: "rule-1", trigger_event: "opportunity.stale", conditions: [], actions: [] };

beforeEach(() => {
  jest.clearAllMocks();
  getActiveRulesByEvent.mockResolvedValue({ rows: [] });
  getStaleLeadCandidates.mockResolvedValue({ rows: [] });
  getStaleOpportunityCandidates.mockResolvedValue({ rows: [] });
  getStuckOpportunityCandidates.mockResolvedValue({ rows: [] });
  evaluateConditions.mockReturnValue(true);
});

test("the sweep is throttled per process unless forced", async () => {
  const first = await sweepCrmTimeTriggers();
  expect(first.skipped).toBe(false);

  const second = await sweepCrmTimeTriggers();
  expect(second.skipped).toBe(true);

  const forced = await sweepCrmTimeTriggers({ force: true });
  expect(forced.skipped).toBe(false);
  expect(TIME_TRIGGER_SWEEP_INTERVAL_MS).toBeGreaterThan(0);
});

test("an event nobody listens to costs no candidate read", async () => {
  await sweepCrmTimeTriggers({ force: true, now: NOW });

  expect(getStaleLeadCandidates).not.toHaveBeenCalled();
  expect(getStaleOpportunityCandidates).not.toHaveBeenCalled();
  expect(getStuckOpportunityCandidates).not.toHaveBeenCalled();
  expect(fireCrmEvent).not.toHaveBeenCalled();
});

test("each matching candidate fires the engine once, with a day-scoped event id", async () => {
  getActiveRulesByEvent.mockImplementation(async (event) =>
    event === "opportunity.stale" ? { rows: [RULE] } : { rows: [] },
  );
  getStaleOpportunityCandidates.mockResolvedValue({
    rows: [
      { id: "o-1", name: "MTN", status: "active", stage_name: "Proposal" },
      { id: "o-2", name: "Moov", status: "active", stage_name: "Discussion" },
    ],
  });

  const result = await sweepCrmTimeTriggers({ force: true, now: NOW });

  expect(result).toMatchObject({ fired: 2, evaluated: 2 });
  expect(fireCrmEvent).toHaveBeenCalledTimes(2);
  expect(fireCrmEvent).toHaveBeenNthCalledWith(
    1,
    "opportunity.stale",
    expect.objectContaining({ id: "o-1", entity_type: "opportunity" }),
    "opportunity.stale:o-1:2026-10-13",
    null,
  );
  expect(fireCrmEvent).toHaveBeenNthCalledWith(
    2,
    "opportunity.stale",
    expect.objectContaining({ id: "o-2", entity_type: "opportunity" }),
    "opportunity.stale:o-2:2026-10-13",
    null,
  );
});

test("a candidate no rule matches is never sent to the engine", async () => {
  getActiveRulesByEvent.mockImplementation(async (event) =>
    event === "lead.stale" ? { rows: [{ ...RULE, trigger_event: "lead.stale" }] } : { rows: [] },
  );
  getStaleLeadCandidates.mockResolvedValue({
    rows: [{ id: "l-1", title: "MTN", status: "new" }],
  });
  evaluateConditions.mockReturnValue(false);

  const result = await sweepCrmTimeTriggers({ force: true, now: NOW });

  expect(result).toMatchObject({ fired: 0, evaluated: 0 });
  expect(fireCrmEvent).not.toHaveBeenCalled();
});

test("a matching lead candidate is sent with the lead entity type", async () => {
  getActiveRulesByEvent.mockImplementation(async (event) =>
    event === "lead.stale" ? { rows: [{ ...RULE, trigger_event: "lead.stale" }] } : { rows: [] },
  );
  getStaleLeadCandidates.mockResolvedValue({
    rows: [{ id: "l-1", title: "MTN", status: "new" }],
  });

  await sweepCrmTimeTriggers({ force: true, now: NOW });

  expect(fireCrmEvent).toHaveBeenCalledWith(
    "lead.stale",
    expect.objectContaining({ id: "l-1", entity_type: "lead" }),
    "lead.stale:l-1:2026-10-13",
    null,
  );
});
