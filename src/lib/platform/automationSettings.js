/**
 * EFFECTIVE AUTOMATION FLAGS FOR A FORM RUN
 *
 * The FORM carries the designed defaults; the RUN decides. Every flag resolves
 * in this order, per flag — not per section — so a run can change one switch
 * without losing the rest of the form's configuration:
 *
 *   run.settings.automation.<path>  →  form.settings.automation.<path>  →  true
 *
 * ABSENT MEANS ON. That is the historic behaviour every caller already relied on
 * (`auto.on_approve?.x !== false`), so a form — or a run — that has never
 * configured automation keeps sending exactly what it sends today. Only an
 * explicit `false`, at either level, suppresses a send.
 *
 * Only booleans count as a decision. A null/undefined/"" left behind by an
 * editor falls through to the next level instead of being read as "off", which
 * is what makes "clear the run override" work without writing `true` everywhere.
 */

/** Read a dotted path from a settings object without throwing on any shape. */
function read(value, path) {
  return path
    .split(".")
    .reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), value);
}

/**
 * Resolve one automation flag to the boolean the engine should act on.
 *
 * @param {object|null} formSettings  the form row's `settings` JSON
 * @param {object|null} runSettings   the run row's `settings` JSON
 * @param {string} path               e.g. "on_approve.send_approval_email"
 * @returns {boolean} the effective value, defaulting to true
 */
export function resolveAutomationFlag(formSettings, runSettings, path) {
  const runValue = read(runSettings?.automation, path);
  if (typeof runValue === "boolean") return runValue;

  const formValue = read(formSettings?.automation, path);
  if (typeof formValue === "boolean") return formValue;

  return true;
}

/** Every flag the UI can set on a run, as dotted paths. */
export const AUTOMATION_FLAG_PATHS = [
  "on_submit.send_acknowledgement",
  "on_approve.send_approval_email",
  "on_approve.create_platform_user",
  "on_approve.send_activation_email",
  "on_approve.enroll_in_program",
  "on_approve.assign_to_group",
  "on_reject.send_rejection_email",
];

/** The effective value of every flag, for display. */
export function effectiveAutomation(formSettings, runSettings) {
  const out = {};
  for (const path of AUTOMATION_FLAG_PATHS) {
    out[path] = resolveAutomationFlag(formSettings, runSettings, path);
  }
  return out;
}

/** Does this run override anything at all? Used by the run settings screen. */
export function hasRunAutomationOverride(runSettings) {
  const auto = runSettings?.automation;
  if (!auto || typeof auto !== "object") return false;
  return AUTOMATION_FLAG_PATHS.some((path) => typeof read(auto, path) === "boolean");
}
