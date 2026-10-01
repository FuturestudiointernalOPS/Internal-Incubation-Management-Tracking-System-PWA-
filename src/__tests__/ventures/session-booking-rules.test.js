/**
 * Lane L2 — the session booking rules moved out of the sessions controller
 * (`services/ventures/sessionBooking.js`). Characterises every refusal and the
 * cleaned values, so the move stays behaviour-identical.
 */
const { checkSessionBooking } = require("@/services/ventures/sessionBooking");
const { SESSION_MIN_LEAD_MINUTES } = require("@/lib/ventureSessionRules");

const NOW = Date.UTC(2026, 9, 1, 10, 0, 0);
const later = (minutes) => new Date(NOW + minutes * 60 * 1000).toISOString();
const valid = () => ({
  description: "  Pitch review  ",
  milestone_ref: 42,
  start_time: later(SESSION_MIN_LEAD_MINUTES + 5),
});

describe("checkSessionBooking", () => {
  test("a complete booking passes, with the memo trimmed and the milestone as a string", () => {
    const result = checkSessionBooking(valid(), NOW);
    expect(result.ok).toBe(true);
    expect(result.sessionNote).toBe("Pitch review");
    expect(result.milestoneRef).toBe("42");
    expect(Array.isArray(result.materials)).toBe(true);
  });

  test("the agenda stands in for a missing description", () => {
    const result = checkSessionBooking({ ...valid(), description: "", agenda: "Agenda" }, NOW);
    expect(result).toMatchObject({ ok: true, sessionNote: "Agenda" });
  });

  test("no memo is refused", () => {
    expect(checkSessionBooking({ ...valid(), description: "   " }, NOW))
      .toEqual({ ok: false, error: "A session note is required." });
  });

  test("no milestone is refused", () => {
    expect(checkSessionBooking({ ...valid(), milestone_ref: null }, NOW))
      .toEqual({ ok: false, error: "A session must belong to a milestone." });
  });

  test("no or an invalid date is refused", () => {
    const refusal = { ok: false, error: "A session date and time are required." };
    expect(checkSessionBooking({ ...valid(), start_time: null }, NOW)).toEqual(refusal);
    expect(checkSessionBooking({ ...valid(), start_time: "not a date" }, NOW)).toEqual(refusal);
  });

  test("a start inside the minimum lead time is refused", () => {
    expect(checkSessionBooking({ ...valid(), start_time: later(SESSION_MIN_LEAD_MINUTES - 1) }, NOW))
      .toEqual({ ok: false, error: `A session must start at least ${SESSION_MIN_LEAD_MINUTES} minutes from now.` });
  });

  test("invalid materials are refused", () => {
    const tooMany = Array.from({ length: 50 }, (_, index) => ({ name: `d${index}`, path: `x/${index}` }));
    expect(checkSessionBooking({ ...valid(), materials: tooMany }, NOW))
      .toEqual({ ok: false, error: "The session materials are invalid (up to 5 documents)." });
  });
});
