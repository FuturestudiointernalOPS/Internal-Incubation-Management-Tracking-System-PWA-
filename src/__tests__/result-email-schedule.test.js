/**
 * Scheduled result email — "send it N hours M minutes after each submission".
 *
 * The delay rides on the result TEMPLATE's entry, so it resolves on the same
 * run → form chain as the text. Three things must never drift:
 *
 *   1. The resolver. An ABSENT run value falls through to the form, but an
 *      explicit 0 stops the automatic send for that run — 0 is a decision, not
 *      a missing value. Confusing the two would either resurrect a disabled
 *      send or lose a form default.
 *   2. One sender. The dispatcher calls the SAME sendResultEmailForSubmission
 *      the manual action uses, so the per-submission sentinel and the
 *      duplicate-recipient guard apply: a second sweep never sends twice.
 *   3. Editable templates. The editors are declared at MODULE scope. A component
 *      created during a render is a new type on every render, so React would
 *      remount its inputs on each keystroke and the field would lose focus after
 *      every letter — the author could never finish a sentence.
 */
const fs = require("fs");
const path = require("path");

const { resolveResultDelayMinutes } = require("@/lib/email");
const { readResultDelayMinutes } = require("@/lib/constants");

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const ROUTE_SRC = read("src/app/api/platform/form-runs/route.js");
const MODEL_SRC = read("src/models/formRuns.js");
const RUNS_PAGE = read("src/app/platform/runs/page.js");
const FORMS_PAGE = read("src/app/platform/forms/page.js");
const DELAY_EDITOR = read("src/components/ui/ResultDelayEditor.js");

const formWith = (entry) => ({ automation: { templates: { result: entry } } });
const runWith = (entry) => ({ templates: { result: entry } });

describe("resolveResultDelayMinutes — run → form → nothing, in minutes", () => {
  test("the run's delay wins over the form's", () => {
    expect(resolveResultDelayMinutes(formWith({ delay_minutes: 2880 }), runWith({ delay_minutes: 90 }))).toBe(90);
  });

  test("minutes are the unit, and a legacy hours value is still read", () => {
    expect(resolveResultDelayMinutes({}, runWith({ delay_minutes: 45 }))).toBe(45);
    expect(resolveResultDelayMinutes({}, runWith({ delay_hours: 48 }))).toBe(2880);
    // Minutes win when both are present — the canonical field.
    expect(resolveResultDelayMinutes({}, runWith({ delay_minutes: 30, delay_hours: 48 }))).toBe(30);
  });

  test("an absent run value falls through to the form", () => {
    expect(resolveResultDelayMinutes(formWith({ delay_minutes: 2880 }), {})).toBe(2880);
    expect(resolveResultDelayMinutes(formWith({ delay_hours: 2 }), undefined)).toBe(120);
    expect(resolveResultDelayMinutes(formWith({ delay_minutes: 10 }), runWith({ delay_minutes: "" }))).toBe(10);
    expect(resolveResultDelayMinutes(formWith({ delay_minutes: 10 }), runWith({ delay_minutes: null }))).toBe(10);
  });

  test("an explicit 0 on the run STOPS the form's automatic send", () => {
    // 0 is a decision — send by hand for this run — not a missing value.
    expect(resolveResultDelayMinutes(formWith({ delay_minutes: 2880 }), runWith({ delay_minutes: 0 }))).toBe(0);
    expect(resolveResultDelayMinutes(formWith({ delay_hours: 48 }), runWith({ delay_hours: 0 }))).toBe(0);
  });

  test("nothing configured means nothing scheduled", () => {
    expect(resolveResultDelayMinutes({}, {})).toBe(0);
    expect(resolveResultDelayMinutes(undefined, undefined)).toBe(0);
    expect(resolveResultDelayMinutes(formWith({ delay_minutes: "" }), {})).toBe(0);
  });

  test("nonsense is ignored rather than half-read", () => {
    expect(resolveResultDelayMinutes({}, runWith({ delay_minutes: "45" }))).toBe(45);
    expect(resolveResultDelayMinutes(formWith({ delay_minutes: -5 }), {})).toBe(0);
    expect(resolveResultDelayMinutes(formWith({ delay_minutes: "soon" }), {})).toBe(0);
  });
});

describe("readResultDelayMinutes — the single entry the editors write", () => {
  test("null when the entry sets no delay, a number otherwise", () => {
    expect(readResultDelayMinutes(undefined)).toBe(null);
    expect(readResultDelayMinutes({})).toBe(null);
    expect(readResultDelayMinutes({ delay_minutes: 0 })).toBe(0);
    expect(readResultDelayMinutes({ delay_minutes: 90 })).toBe(90);
    expect(readResultDelayMinutes({ delay_hours: 1 })).toBe(60);
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
    expect(ROUTE_SRC).toMatch(/resolveResultDelayMinutes\(candidate\.form_settings \|\| \{\}, candidate\.run_settings \|\| \{\}\)/);
    expect(ROUTE_SRC).toMatch(/if \(delayMinutes <= 0\) continue;/);
    expect(ROUTE_SRC).toMatch(/submittedAt \+ delayMinutes \* 60 \* 1000 > now/);
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
    expect(ROUTE_SRC).toMatch(/scheduleResultSweep\(id\);/);
    expect(ROUTE_SRC).toMatch(/scheduleResultSweep\(submissionRunResult\.rows\[0\]\.run_id\);/);
  });
});

describe("the views — where the timing is set and shown", () => {
  test("both screens use the shared delay control", () => {
    expect(RUNS_PAGE).toMatch(/from "@\/components\/ui\/ResultDelayEditor"/);
    expect(FORMS_PAGE).toMatch(/from "@\/components\/ui\/ResultDelayEditor"/);
    expect(RUNS_PAGE).toMatch(/<ResultDelayEditor/);
    expect(FORMS_PAGE).toMatch(/<ResultDelayEditor/);
  });

  test("the control offers hours AND minutes, over one canonical number", () => {
    expect(DELAY_EDITOR).toMatch(/hoursLabel/);
    expect(DELAY_EDITOR).toMatch(/minutesLabel/);
    // Minutes wrap at 59 so the two fields always mean what they show.
    expect(DELAY_EDITOR).toMatch(/Math\.min\(59, Math\.max\(0, Math\.floor\(nextMinutes\)\)\)/);
  });

  test("the run writes an explicit 0 when switched off, and drops the legacy field", () => {
    expect(RUNS_PAGE).toMatch(/const setRunResultDelay = \(minutes\) => \{/);
    expect(RUNS_PAGE).toMatch(/next\.result\.delay_minutes = minutes;/);
    expect(RUNS_PAGE).toMatch(/delete next\.result\.delay_hours;/);
  });

  test("a delay-only entry survives the run template save", () => {
    // Without this, a run that only schedules the send would lose its entry and
    // silently fall back to the form's delay.
    expect(RUNS_PAGE).toMatch(/return subject \|\| body \|\| readResultDelayMinutes\(template\) !== null;/);
  });

  test("the form writes the delay in the same canonical unit", () => {
    expect(FORMS_PAGE).toMatch(/updateTemplate\("result", "delay_minutes", minutes\)/);
  });

  test("the template editors are declared at module scope, not during a render", () => {
    // The focus bug: a component created inside the render is a new type every
    // render, so React remounts its inputs and the field loses focus after each
    // keystroke. Column-zero `function` means module scope.
    expect(RUNS_PAGE).toMatch(/^function RunTemplateEditor\(/m);
    expect(FORMS_PAGE).toMatch(/^function TemplateEditor\(/m);
    // …and no render-local shadow may come back and undo it.
    expect(RUNS_PAGE).not.toMatch(/^\s+const RunTemplateEditor = /m);
    expect(FORMS_PAGE).not.toMatch(/^\s+const TemplateEditor = /m);
  });
});
