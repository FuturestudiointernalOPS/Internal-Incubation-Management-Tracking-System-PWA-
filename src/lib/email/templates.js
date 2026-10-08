/**
 * The template engine
 *
 * Default copy, `{{variable}}` substitution, and the designed-template lookup.
 *  * Pure text in, text out: this module sends nothing.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { TEMPLATE_VARIABLE_PATTERN } from "@/lib/constants";

/**
 * Shared, application-controlled email footer. Appended by the senders AFTER
 * template personalization so the AI can never remove or modify it.
 */
export const FUTURE_STUDIO_FOOTER = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;font-size:12px;line-height:1.6;color:#94a3b8;">
    <strong style="color:#f8fafc;">Future Studio</strong> —
    <a href="https://futurestudio.bj" style="color:#f97316;text-decoration:none;font-weight:700;">futurestudio.bj</a>
  </div>`;

const DEFAULT_TEMPLATES = {
  acknowledgement: {
    subject: "Thank you for your submission — {{form_name}}",
    body: `<p>Hello {{name}},</p><p>We have received your submission for <strong>{{form_name}}</strong>.</p><p>Our team will review it and get back to you soon.</p>`,
  },
  approval: {
    subject: "Your {{form_name}} application has been approved",
    body: `<p>Congratulations {{name}}!</p><p>Your application for <strong>{{form_name}}</strong> has been approved.</p><p>We are excited to welcome you.</p>`,
  },
  rejection: {
    subject: "Update on your {{form_name}} application",
    body: `<p>Dear {{name}},</p><p>Thank you for your interest in <strong>{{form_name}}</strong>.</p><p>Unfortunately, you were not selected this time. We encourage you to apply again in the future.</p>`,
  },
  activation: {
    subject: "Welcome to {{organization}} — Set Your Password",
    body: `<p>Hello {{name}},</p><p>Your account has been created on <strong>{{organization}}</strong>.</p><p>Click the button below to create your password and access your dashboard.</p>`,
  },
  existing_user: {
    subject: "Welcome back to {{organization}} — Log In",
    body: `<p>Hello {{name}},</p><p>You already have an account with us. You can access the platform using your existing login credentials.</p>`,
  },
  result: {
    // The NEUTRAL result wording. A Founder Fit Score run still gets its own
    // built-in message INSTEAD of this one (see sendResultEmail), so this default
    // is what every other run falls back to — and the base the AI personalizes.
    // The subject is built on the recipient's name, which is why it still reads
    // correctly when no name is known (the leading comma is tidied away).
    subject: "{{name}}, your result is ready",
    body: `<p>Hello {{name}},</p><p>The result of your submission is ready. The document contains your responses, the evaluation of your submission and your final score.</p><p>Thank you for participating.</p>`,
  },
};

/**
 * Replace {{variables}} in a template string with provided values, then remove
 * whatever placeholder is left over.
 *
 * Only the names this caller actually passes can be filled in. Any OTHER name
 * has no value and must never reach a recipient as raw `{{text}}` — so the
 * final sweep deletes it. The template editors warn about those names as they
 * are typed (see findUnknownTemplateVariables), making this a safety net rather
 * than the only line of defence.
 */
export function applyTemplate(text, vars = {}) {
  if (!text) return "";
  let result = String(text);
  for (const [key, val] of Object.entries(vars)) {
    // A name this sender provides is filled in even when the template carries
    // extra spaces ({{ name }}), so a hand-typed placeholder is not a trap.
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), val != null ? String(val) : "");
  }
  const swept = result.replace(TEMPLATE_VARIABLE_PATTERN, "");
  // An empty value must not strand the punctuation around it: "Bonjour {{name}},"
  // with no known name would read "Bonjour ," — and a SUBJECT built on the name
  // ("{{name}}, your result is ready") would read ", your result is ready".
  //
  // Only the comma and the full stop are tidied, because in French typography a
  // space before ! ? ; or : is correct; and the leading rule demands a space
  // AFTER the mark, so ".NET" is never touched.
  return swept.replace(/\s+([,.])/g, "$1").replace(/^\s*[,.]\s+/, "");
}

/**
 * Resolve a template with a run-level override chain:
 * run.settings.templates[key] → form.settings.automation.templates[key] → DEFAULT_TEMPLATES.
 * Blank (empty/whitespace) values fall through to the next level, so an
 * empty run-level field can never shadow a designed form-level template
 * (the UI promises "Empty = use the form template, then the platform default").
 */
export function getTemplate(formSettings, templateKey, runSettings) {
  const custom = formSettings?.automation?.templates?.[templateKey] || {};
  const runCustom = runSettings?.templates?.[templateKey] || {};
  const text = (value) => (typeof value === "string" ? value.trim() : value);
  // Per-field fallthrough: run value (non-blank) → form value (non-blank) → default
  const pick = (runVal, formVal) => text(runVal) || text(formVal) || "";
  const def = DEFAULT_TEMPLATES[templateKey];
  return {
    subject: pick(runCustom.subject, custom.subject) || def?.subject || "",
    body: pick(runCustom.body, custom.body) || def?.body || "",
  };
}

/**
 * The platform's built-in template for a key (used as the base structure
 * when AI personalization runs on an empty draft).
 */
export function getDefaultTemplate(templateKey) {
  const def = DEFAULT_TEMPLATES[templateKey];
  return { subject: def?.subject || "", body: def?.body || "" };
}

/**
 * Resolve ONLY the DESIGNED levels of a template — run, then form — without the
 * platform default.
 *
 * The result message needs this: its built-in wording depends on the kind of
 * run (a Founder Fit Score run has its own message), so the platform default
 * must not be reached before that choice is made — otherwise adding a default
 * would silently replace every run's specific message. Blank values fall
 * through exactly like getTemplate.
 */
export function getDesignedTemplate(formSettings, templateKey, runSettings) {
  const custom = formSettings?.automation?.templates?.[templateKey] || {};
  const runCustom = runSettings?.templates?.[templateKey] || {};
  const text = (value) => (typeof value === "string" ? value.trim() : value);
  const pick = (runVal, formVal) => text(runVal) || text(formVal) || "";
  return { subject: pick(runCustom.subject, custom.subject), body: pick(runCustom.body, custom.body) };
}

/**
 * How long, in MINUTES, a submission waits after it is sent before its result is
 * emailed automatically. The delay lives with the template it belongs to:
 *   • run  → settings.templates.result.{delay_minutes|delay_hours}
 *   • form → settings.automation.templates.result.{delay_minutes|delay_hours}
 *
 * Minutes are the canonical unit; a `delay_hours` written by an earlier version
 * is still read (×60) so no saved setting is lost.
 *
 * An ABSENT run value falls through to the form; an explicit 0 stops the
 * automatic send for that run (the operator sends by hand). That is the one
 * place this resolver differs from the text one: there, blank means "not set";
 * here, an explicit 0 must be obeyed. 0 (or nothing to send) is the default.
 */
export function resolveResultDelayMinutes(formSettings, runSettings) {
  const parse = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return Math.floor(amount);
  };
  const readEntry = (entry) => {
    const minutes = parse(entry?.delay_minutes);
    if (minutes !== null) return minutes;
    const hours = parse(entry?.delay_hours);
    return hours !== null ? hours * 60 : null;
  };
  const fromRun = readEntry(runSettings?.templates?.result);
  if (fromRun !== null) return fromRun;
  const fromForm = readEntry(formSettings?.automation?.templates?.result);
  return fromForm !== null ? fromForm : 0;
}
