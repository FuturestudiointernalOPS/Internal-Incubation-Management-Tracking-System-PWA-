/**
 * FORM vs RUN SETTINGS — the one map of every settings key, and the scoring rule.
 *
 * A FORM (`platform_forms.settings`) is the reusable design; a RUN
 * (`platform_form_runs.settings`) is one instance of it and may override it.
 * Every key below lists its level (form / run / both), the rule that decides it
 * and its default. Resolvers are READ-ONLY: the Run Settings PUT writes the whole
 * JSONB blob, so nothing may rebuild a settings object (unknown or future keys
 * would be dropped). Plain functions, no imports: safe for the client.
 *
 * Where each "both" rule lives:
 *   automation flags  → `@/lib/platform/automationSettings` (resolveAutomationFlag)
 *   templates / delay → `@/lib/email/templates` (getTemplate, getDesignedTemplate,
 *                       resolveResultDelayMinutes)
 *   scoring           → resolveRunScoring, below
 *
 * Loader: `getRunSettingsContextById(runId)` (`@/models/formRuns`) returns the
 * form's `name` + `settings` and the run's `settings` as `run_settings` — the two
 * levels every resolver here takes.
 *
 * Old vs new runs (automation): `migrations/copy_form_automation_to_runs.sql`
 * copied each form's `automation` block onto the runs that existed then (a
 * one-time SNAPSHOT, only where the run had none). A run created since gets
 * `settings = {}` — the create screen sends none and `createRun` copies none —
 * so it reads the form LIVE through resolveAutomationFlag (run → form → on).
 */

/**
 * @typedef {object} SettingKey
 * @property {"form"|"run"|"both"} level  where the key is stored and read
 * @property {string} rule                how its value is decided
 * @property {*} default                  value when nothing is set
 */

/** @type {Record<string, SettingKey>} */
export const RUN_SETTINGS_MAP = {
  // ── Resolved run → form → default ──
  "automation.<section>.<flag>": {
    level: "both",
    rule: "run boolean → form boolean → true. ABSENT MEANS ON; only an explicit false turns a flag off; null/\"\" fall through (resolveAutomationFlag).",
    default: true,
  },
  scoring: {
    level: "both",
    rule: "run.scoring when enabled → form.scoring when enabled → none. A run scoring with enabled:false falls through to the form (resolveRunScoring).",
    default: null,
  },
  "templates.<key>.{subject,body}": {
    level: "both",
    rule: "per field: run templates.<key> (non-blank) → form automation.templates.<key> (non-blank) → platform default (getTemplate) or blank (getDesignedTemplate). Blank means not set.",
    default: "platform default template",
  },
  "templates.result.{delay_minutes,delay_hours}": {
    level: "both",
    rule: "run → form automation.templates.result → 0. An explicit 0 on the run is obeyed (stop); blank/negative falls through; delay_hours is read ×60 (resolveResultDelayMinutes).",
    default: 0,
  },

  // ── Run only ──
  submission_limit: { level: "run", rule: "parseInt; 0 or invalid = unlimited; only a new non-draft response consumes a seat.", default: 0 },
  allow_multiple: { level: "run", rule: "only true allows a second response (public submit: per email; signed-in submit: per submitter).", default: false },
  auto_close: { level: "run", rule: "stop accepting responses once closed. Public submit and run detail test === true; signed-in submit tests truthiness.", default: false },
  anonymous: { level: "run", rule: "=== true hides who answered from reviewers (run detail, single submission read).", default: false },
  confirmation_message: { level: "run", rule: "run text → form automation.success_message (public submit) → built-in message.", default: null },
  instructions: { level: "run", rule: "shown above the form when non-blank.", default: null },
  output_instruction: { level: "run", rule: "string, trimmed; drives the result document / report.", default: "" },

  // ── Form only ──
  ai_evaluation: { level: "form", rule: "=== true AND an evaluation framework exists for the form (formHasAiEvaluation).", default: false },
  investor_application: { level: "form", rule: "true (or \"true\") marks the Investor Application form.", default: false },
  workflow: { level: "form", rule: "merged over the review page's DEFAULT_WORKFLOW.", default: "DEFAULT_WORKFLOW" },
};

/**
 * NOT a settings key: `report_file` is the run's generated report, stored in its
 * own table (`platform_run_report_files`) and returned beside the run by the
 * run-detail read. It is listed here so nobody looks for it in `settings`.
 */
export const RUN_REPORT_FILE_SOURCE = "platform_run_report_files";

/**
 * The scoring config that applies to a run: the run's when it is enabled, else
 * the form's when it is enabled, else none. Read-only — returns one of the
 * given objects, never a rebuilt one.
 *
 * @param {object|null} formSettings  the form row's `settings` JSON
 * @param {object|null} runSettings   the run row's `settings` JSON
 * @returns {object|null}
 */
export function resolveRunScoring(formSettings, runSettings) {
  const run = runSettings?.scoring;
  if (run?.enabled) return run;
  const form = formSettings?.scoring;
  if (form?.enabled) return form;
  return null;
}
