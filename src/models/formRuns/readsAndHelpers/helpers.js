import db from "@/lib/db";

/**
 * Platform form-run model — shared helpers (REPOSITORY layer).
 *
 * Timeline logging, assignment-name enrichment and the run/form scoring-settings
 * lookups. Split verbatim out of `models/formRuns/readsAndHelpers.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Append a row to a submission's timeline (fire-and-forget at call site). */
export async function insertTimelineEntry(submissionId, action, actorId, actorName, meta) {
  return db.execute({
    sql: `INSERT INTO platform_submission_timeline (submission_id, action, actor_id, actor_name, metadata) VALUES (?, ?, ?, ?, ?)`,
    args: [submissionId, action, actorId || null, actorName || null, JSON.stringify(meta)],
  });
}

/** Contacts matched by cid OR lower(email) for assignment name/email enrichment. */
export async function getContactsForAssignmentEnrichment(userIds, emails) {
  return db.execute({
    sql: 'SELECT cid, name, email FROM contacts WHERE cid = ANY(?) OR LOWER(email) = ANY(?)',
    args: [userIds, emails],
  });
}

/** Families matched by registration_id OR cast(id) for assignment enrichment. */
export async function getFamiliesForAssignmentEnrichment(groupIds) {
  return db.execute({
    sql: 'SELECT id, registration_id, name FROM families WHERE registration_id = ANY(?) OR CAST(id AS TEXT) = ANY(?)',
    args: [groupIds, groupIds],
  });
}

/** Programs matched by id for assignment enrichment. */
export async function getProgramsForAssignmentEnrichment(programIds) {
  return db.execute({
    sql: 'SELECT id, name FROM v2_programs WHERE id = ANY(?)',
    args: [programIds],
  });
}

/** Run scoring settings lookup (run-level scoring config). */
export async function getRunScoringSettingsById(runId) {
  return db.execute({
    sql: "SELECT form_id, settings FROM platform_form_runs WHERE id = ?",
    args: [parseInt(runId)],
  });
}

/** Form settings lookup — fallback scoring config when the run has none. */
export async function getFormScoringSettingsById(formId) {
  return db.execute({
    sql: "SELECT settings FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}
