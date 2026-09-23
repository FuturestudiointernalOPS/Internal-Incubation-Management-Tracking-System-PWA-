/**
 * Scheduled result email — "send it 48 h after each submission".
 *
 * The delay rides on the result TEMPLATE's entry, so it resolves on the same
 * run → form chain as the text. Two things must never drift:
 *
 *   1. The resolver. An ABSENT run value falls through to the form, but an
 *      explicit 0 stops the automatic send for that run — 0 is a decision, not
 *      a missing value. Confusing the two would either resurrect a disabled
 *      send or lose a form default.
 *   2. One sender. The dispatcher calls the SAME sendResultEmailForSubmission
 *      the manual action uses, so the per-submission sentinel and the
 *      duplicate-recipient guard apply: a second sweep never sends twice.
 */
const fs = require("fs");
const path = require("path");

const { resolveResultDelayHours } = require("@/lib/email");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const ROUTE_SRC = read("src/app/api/platform/form-runs/route.js");
const MODEL_SRC = read("src/models/formRuns.js");
const RUNS_PAGE = read("src/app/platform/runs/page.js");
const FORMS_PAGE = read("src/app/platform/forms/page.js");

const formWith = (delayHours) => ({ automation: { templates: { result: { delay_hours: delayHours } } } });
const runWith = (delayHours) => ({ templates: { result: { delay_hours: delayHours } } });

describe("resolveResultDelayHours — run → form → nothing", () => {
  test("the run's delay wins over the form's", () => {
    expect(resolveResultDelayHours(formWith(48), runWith(12))).toBe(12);
  });

  test("an absent run value falls through to the form", () => {
    expect(resolveResultDelayHours(formWith(48), {})).toBe(48);
    expect(resolveResultDelayHours(formWith(48), undefined)).toBe(48);
    expect(resolveResultDelayHours(formWith(48), runWith(""))).toBe(48);
    expect(resolveResultDelayHours(formWith(48), runWith(null))).toBe(48);
  });

  test("an explicit 0 on the run STOPS the form's automatic send", () => {
    // 0 is a decision — send by hand for this run — not a missing value.
    expect(resolveResultDelayHours(formWith(48), runWith(0))).toBe(0);
  });

  test("nothing configured means nothing scheduled", () => {
    expect(resolveResultDelayHours({}, {})).toBe(0);
    expect(resolveResultDelayHours(undefined, undefined)).toBe(0);
    expect(resolveResultDelayHours(formWith(""), {})).toBe(0);
  });

  test("a numeric string is read, and nonsense is ignored", () => {
    expect(resolveResultDelayHours({}, { templates: { result: { delay_hours: "72" } } })).toBe(72);
    expect(resolveResultDelayHours(formWith(-5), {})).toBe(0);
    expect(resolveResultDelayHours(formWith("soon"), {})).toBe(0);
    expect(resolveResultDelayHours({}, runWith(-1))).toBe(0);
  });

  test("hours are whole hours", () => {
    expect(resolveResultDelayHours({}, runWith(2.9))).toBe(2);
  });
});

describe("the dispatcher — one sender, time-based, idempotent by construction", () => {
  test("only the approved, not-yet-sent submissions are candidates", () => {
    expect(MODEL_SRC).toMatch(/ps\.status = 'approved'/);
    expect(MODEL_SRC).toMatch(/ps\.submitted_at IS NOT NULL/);
    // The sent row is the sentinel: once it exists, the submission is out of
    // the candidate set, so a second sweep can never resend.
    expect(MODEL_SRC).toMatch(/el\.email_type = 'result' AND el\.status = 'sent'/);
  });

  test("the clock starts at the submission, and 0 asks for nothing", () => {
    expect(ROUTE_SRC).toMatch(/async function dispatchScheduledResultEmails\(\{ run_id = null \} = \{\}\)/);
    expect(ROUTE_SRC).toMatch(/resolveResultDelayHours\(candidate\.form_settings \|\| \{\}, candidate\.run_settings \|\| \{\}\)/);
    expect(ROUTE_SRC).toMatch(/if \(delayHours <= 0\) continue;/);
    expect(ROUTE_SRC).toMatch(/submittedAt \+ delayHours \* 3600 \* 1000 > now/);
  });

  test("it sends through the one result sender, never a second implementation", () => {
    expect(ROUTE_SRC).toMatch(/await sendResultEmailForSubmission\(\{ submission_id: candidate\.id \}\)/);
    // Still exactly one PDF build site in the whole route.
    expect((ROUTE_SRC.match(/buildSubmissionResultPdf\(\{/g) || []).length).toBe(1);
  });

  test("the log table exists before the candidate query reads it", () => {
    const dispatchStart = ROUTE_SRC.indexOf("async function dispatchScheduledResultEmails");
    const ensure = ROUTE_SRC.indexOf("await ensureEmailLogTable();", dispatchStart);
    const query = ROUTE_SRC.indexOf("await listApprovedSubmissionsAwaitingResultEmail();", dispatchStart);
    expect(ensure).toBeGreaterThan(dispatchStart);
    expect(query).toBeGreaterThan(ensure);
  });

  test("a scheduled caller is accepted, otherwise a capability is required", () => {
    expect(ROUTE_SRC).toMatch(/action === "dispatch_scheduled_result_emails"/);
    expect(ROUTE_SRC).toMatch(/req\.headers\.get\("x-cron-secret"\)/);
    expect(ROUTE_SRC).toMatch(/process\.env\.CRON_SECRET/);
    expect(ROUTE_SRC).toMatch(/requireAuthorization\("runs", "edit"\)/);
  });

  test("a timer is a convenience, not the only way a result leaves", () => {
    // Opening a run sweeps it; approving a submission sweeps it too.
    expect(ROUTE_SRC).toMatch(/scheduleResultSweep\(id\);/);
    expect(ROUTE_SRC).toMatch(/scheduleResultSweep\(submissionRunResult\.rows\[0\]\.run_id\);/);
  });
});

describe("the views — where the timing is set and shown", () => {
  test("the run's template tab carries the schedule control", () => {
    expect(RUNS_PAGE).toMatch(/const ResultScheduleEditor = \(\) => \{/);
    expect(RUNS_PAGE).toMatch(/<ResultScheduleEditor \/>/);
    // Toggling off writes an explicit 0, which is what stops the form's delay.
    expect(RUNS_PAGE).toMatch(/next \? \(effectiveDelay > 0 \? effectiveDelay : 48\) : 0/);
    expect(RUNS_PAGE).toMatch(/updateRunTemplate\("result", "delay_hours"/);
  });

  test("a delay-only entry survives the run template save", () => {
    // Without this, a run that only schedules the send would lose its entry and
    // silently fall back to the form's delay.
    expect(RUNS_PAGE).toMatch(/return subject \|\| body \|\| template\?\.delay_hours !== undefined;/);
  });

  test("the form's template panel carries the default delay", () => {
    expect(FORMS_PAGE).toMatch(/updateTemplate\("result", "delay_hours"/);
  });
});
