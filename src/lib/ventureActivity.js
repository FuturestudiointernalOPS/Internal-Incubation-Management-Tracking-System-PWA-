/**
 * VENTURE ACTIVITY — one readable line per event.
 *
 * The audit stream stores a CODE and, sometimes, a bag of details:
 *
 *   { action: "VENTURE_UPDATED",
 *     details: { updated_fields: ["company_name", "industry"] } }
 *
 * Printing both verbatim put a machine word ("VENTURE_UPDATED") and a raw JSON
 * blob in front of the reader. This module turns the pair into a sentence: a
 * translated label for the event, then a translated summary of what it actually
 * changed — "Fields changed: Company name, Industry".
 *
 * An unknown code or an unknown field degrades to a readable form of its own
 * name ("Lead changed"): never JSON, never a blank, never a raw identifier.
 * Some detail keys are internal plumbing (a form id, a run id) and are dropped
 * rather than shown to a reader who cannot act on them.
 *
 * Presentation only — no SQL, no server imports, safe in a client component.
 */

/** Event code → label key. Both the activity and the history vocabularies. */
const ACTION_KEYS = {
  VENTURE_CREATED: "vadmin.activity.actions.ventureCreated",
  VENTURE_APPROVED: "vadmin.activity.actions.ventureApproved",
  VENTURE_REGISTERED: "vadmin.activity.actions.ventureRegistered",
  VENTURE_UPDATED: "vadmin.activity.actions.ventureUpdated",
  VENTURE_ARCHIVED: "vadmin.activity.actions.ventureArchived",
  VENTURE_RESTORED: "vadmin.activity.actions.ventureRestored",
  LEAD_CHANGED: "vadmin.activity.actions.leadChanged",
  OWNERSHIP_TRANSFERRED: "vadmin.activity.actions.ownershipTransferred",
  FOUNDER_INVITED: "vadmin.activity.actions.founderInvited",
  FOUNDER_ACCEPTED: "vadmin.activity.actions.founderAccepted",
  FOUNDER_REMOVED: "vadmin.activity.actions.founderRemoved",
  ROLE_UPDATED: "vadmin.activity.actions.roleUpdated",
  USER_SUSPENDED: "vadmin.activity.actions.userSuspended",
  USER_REACTIVATED: "vadmin.activity.actions.userReactivated",
  MEMBER_ADDED: "vadmin.activity.actions.memberAdded",
  MEMBER_REMOVED: "vadmin.activity.actions.memberRemoved",
  PROGRAM_PROMOTED: "vadmin.activity.actions.programPromoted",
  PROMOTED: "vadmin.activity.actions.promoted",
  PROFILE_WIZARD_INIT: "vadmin.activity.actions.profileWizardInit",
  PROFILE_SUBMITTED: "vadmin.activity.actions.profileSubmitted",
  VERIFICATION_SUBMITTED: "vadmin.activity.actions.verificationSubmitted",
  VERIFICATION_RESUBMITTED: "vadmin.activity.actions.verificationResubmitted",
  VERIFICATION_APPROVED: "vadmin.activity.actions.verificationApproved",
  VERIFICATION_REJECTED: "vadmin.activity.actions.verificationRejected",
  VERIFICATION_SUSPENDED: "vadmin.activity.actions.verificationSuspended",
  MILESTONE_CREATED: "vadmin.activity.actions.milestoneCreated",
  MILESTONE_UPDATED: "vadmin.activity.actions.milestoneUpdated",
  MILESTONE_COMPLETED: "vadmin.activity.actions.milestoneCompleted",
  DELIVERABLE_SUBMITTED: "vadmin.activity.actions.deliverableSubmitted",
  DELIVERABLE_APPROVED: "vadmin.activity.actions.deliverableApproved",
  DELIVERABLE_REJECTED: "vadmin.activity.actions.deliverableRejected",
  JOURNEY_COMPLETED: "vadmin.activity.actions.journeyCompleted",
  JOURNEY_TEMPLATE_SAVED: "vadmin.activity.actions.journeyTemplateSaved",
  JOURNEY_TEMPLATE_APPLIED: "vadmin.activity.actions.journeyTemplateApplied",
  OPERATING_PLAN_TEMPLATE_APPLIED: "vadmin.activity.actions.operatingPlanTemplateApplied",
  SESSION_SCHEDULED: "vadmin.activity.actions.sessionScheduled",
  COACHING_SCHEDULED: "vadmin.activity.actions.coachingScheduled",
  COACHING_APPROVED: "vadmin.activity.actions.coachingApproved",
  NOTE_ADDED: "vadmin.activity.actions.noteAdded",
};

/** Field name → label key, for the fields a "what changed" line can carry. */
const FIELD_KEYS = {
  company_name: "vadmin.activity.fields.companyName",
  name: "vadmin.activity.fields.companyName",
  registration_number: "vadmin.detail.registrationNumber",
  registration_status: "vadmin.activity.fields.registrationStatus",
  industry: "vadmin.detail.industry",
  sector: "vadmin.activity.fields.sector",
  business_stage: "vadmin.detail.businessStage",
  description: "vadmin.detail.description",
  website: "vadmin.detail.website",
  logo_url: "vadmin.activity.fields.logo",
  mission: "vadmin.activity.fields.mission",
  vision: "vadmin.activity.fields.vision",
  country: "vadmin.activity.fields.country",
  status: "vadmin.activity.fields.status",
  program_id: "vadmin.activity.fields.program",
  role: "vadmin.activity.fields.role",
  title: "vadmin.activity.fields.title",
  email: "vadmin.activity.fields.email",
  phone: "vadmin.activity.fields.phone",
  stage: "vadmin.activity.fields.journeyStage",
  milestone: "vadmin.activity.fields.milestone",
  milestone_title: "vadmin.activity.fields.milestone",
  deliverable: "vadmin.activity.fields.deliverable",
  score: "vadmin.activity.fields.score",
};

/** Detail keys that are plumbing — a reader can never act on them. */
const HIDDEN_DETAIL_KEYS = new Set([
  "form_id",
  "run_id",
  "invitation_id",
  "actor_cid",
  "reviewer_id",
  "id",
  "venture_id",
]);

/** The stored literal for "nobody — the platform did this". */
const SYSTEM_ACTORS = new Set(["", "system", "sa", "auto", "automation", "cron"]);

/** A code as words: "LEAD_CHANGED" → "Lead changed". Last-resort fallback. */
export function humanizeCode(code) {
  const words = String(code || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return "";
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/** True when the stored actor is the platform itself, not a person. */
export function isSystemActor(name) {
  return SYSTEM_ACTORS.has(String(name || "").trim().toLowerCase());
}

/** The event in words. */
export function activityLabel(action, t) {
  const key = ACTION_KEYS[String(action || "")];
  return key ? t(key) : humanizeCode(action);
}

function fieldLabel(field, t) {
  const key = FIELD_KEYS[String(field || "")];
  return key ? t(key) : humanizeCode(field);
}

function formatValue(value, t) {
  if (Array.isArray(value)) return value.map((v) => formatValue(v, t)).filter(Boolean).join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${fieldLabel(k, t)}: ${formatValue(v, t)}`)
      .join(" · ");
  }
  return String(value);
}

/**
 * The stored details bag, whatever the column handed back: an object, or a JSON
 * string (some writers stringify it). Prose that is not JSON stays prose.
 */
function normalizeDetails(details) {
  if (details === null || details === undefined || details === "") return null;
  if (typeof details === "string") {
    const text = details.trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { message: text };
    } catch (_) {
      return { message: text };
    }
  }
  if (typeof details === "object") return Array.isArray(details) ? { message: details.join(", ") } : details;
  return { message: String(details) };
}

/**
 * The readable detail lines of one event — usually one, sometimes several.
 * Always human text; never a serialized object.
 */
export function activityDetails(details, t) {
  const bag = normalizeDetails(details);
  if (!bag) return [];
  const out = [];

  for (const [key, value] of Object.entries(bag)) {
    if (value === null || value === undefined || value === "") continue;
    if (HIDDEN_DETAIL_KEYS.has(key)) continue;

    if (key === "updated_fields") {
      const fields = (Array.isArray(value) ? value : [value])
        .map((f) => fieldLabel(f, t))
        .filter(Boolean);
      if (fields.length > 0) out.push(t("vadmin.activity.updatedFields", { fields: fields.join(", ") }));
      continue;
    }

    if (key === "submission_id") {
      out.push(t("vadmin.activity.submissionRef", { id: value }));
      continue;
    }

    // Free prose the writer already wrote for a reader.
    if (["message", "reason", "comment", "comments", "notes", "note"].includes(key)) {
      const text = formatValue(value, t);
      if (text) out.push(text);
      continue;
    }

    const formatted = formatValue(value, t);
    if (formatted) out.push(`${fieldLabel(key, t)}: ${formatted}`);
  }

  return out;
}

export default { activityLabel, activityDetails, humanizeCode, isSystemActor };
