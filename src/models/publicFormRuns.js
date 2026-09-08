import db from "@/lib/db";

/**
 * Public form-run model — data access for the public form controllers:
 *   - `src/app/api/s/public-submit/route.js`
 *   - `src/app/api/s/public-draft/route.js`
 *   - `src/app/api/s/public-run/route.js`
 *   - `src/app/api/platform/venture-invitations/route.js`
 *   - `src/app/api/platform/venture-invitations/[token]/route.js`
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * Where a controller ran the same query at multiple call sites, the model keeps
 * one function per call site (1:1 extraction — see docs/MVC_REFACTOR.md).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ---------------------------------------------------------------------------
// Public submit (api/s/public-submit) — 15 queries
// ---------------------------------------------------------------------------

/** Add the invitation_id column used by the Venture invitation flow (idempotent). */
export async function ensurePublicSubmitInvitationColumn() {
  return db.execute({
    sql: "ALTER TABLE platform_form_submissions ADD COLUMN IF NOT EXISTS invitation_id INTEGER",
    args: [],
  });
}

/** Index on platform_form_submissions.invitation_id (idempotent). */
export async function ensurePublicSubmitInvitationIndex() {
  return db.execute({
    sql: "CREATE INDEX IF NOT EXISTS idx_form_submissions_invitation ON platform_form_submissions(invitation_id)",
    args: [],
  });
}

/** Rate-limit table for public submissions (idempotent). */
export async function ensurePublicSubmitRateTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS platform_submissions_rate (
            id SERIAL PRIMARY KEY,
            run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
            ip TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          )`,
    args: [],
  });
}

/** Active run id resolved from a public slug (public submit entry lookup). */
export async function getActiveRunIdByPublicSlug(slug) {
  return db.execute({
    sql: "SELECT id FROM platform_form_runs WHERE public_slug = ? AND status = 'active'",
    args: [slug],
  });
}

/** Full active run row by id (public submit existence check). */
export async function getActiveRunById(run_id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ? AND status = 'active'",
    args: [parseInt(run_id)],
  });
}

/** Submissions count for a run + IP within the last hour (rate limiting). */
export async function countRecentSubmissionsFromIp(run_id, ip) {
  return db.execute({
    sql: "SELECT COUNT(*) as c FROM platform_submissions_rate WHERE run_id = ? AND ip = ? AND created_at > NOW() - INTERVAL '1 hour'",
    args: [parseInt(run_id), ip],
  });
}

/** Form id that owns a run (used to resolve submitter identity fields). */
export async function getFormIdByRunId(run_id) {
  return db.execute({
    sql: "SELECT form_id FROM platform_form_runs WHERE id = ?",
    args: [parseInt(run_id)],
  });
}

/** Form fields (id/label/type) for a form (submitter identity resolution). */
export async function getFormFieldsByFormId(form_id) {
  return db.execute({
    sql: "SELECT id, label, field_type FROM platform_form_fields WHERE form_id = ?",
    args: [form_id],
  });
}

/** Existing submitted submission for a run + submitter (idempotent resubmit). */
export async function getSubmittedSubmissionBySubmitter(run_id, submitter_id) {
  return db.execute({
    sql: "SELECT id, status FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? AND status = 'submitted'",
    args: [parseInt(run_id), submitter_id],
  });
}

/** Record one submission attempt for rate limiting. */
export async function insertRateEntryForSubmission(run_id, ip) {
  return db.execute({
    sql: "INSERT INTO platform_submissions_rate (run_id, ip, created_at) VALUES (?, ?, NOW())",
    args: [parseInt(run_id), ip],
  });
}

/** Existing draft row id for a run + submitter (submit-time draft upgrade). */
export async function getDraftSubmissionBySubmitter(run_id, submitter_id) {
  return db.execute({
    sql: "SELECT id FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? AND status = 'draft'",
    args: [parseInt(run_id), submitter_id],
  });
}

/** Upgrade an existing draft to a submitted submission. */
export async function upgradeDraftToSubmitted(data, submitter_name, invitation_id, draft_id) {
  return db.execute({
    sql: "UPDATE platform_form_submissions SET status = 'submitted', data = ?, submitted_at = NOW(), submitter_name = ?, invitation_id = COALESCE(?, invitation_id) WHERE id = ?",
    args: [JSON.stringify(data), submitter_name, invitation_id, draft_id],
  });
}

/** Insert a brand-new submitted submission (returns its id). */
export async function insertSubmittedSubmission(run_id, submitter_id, submitter_name, data, invitation_id) {
  return db.execute({
    sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, invitation_id, submitted_at)
              VALUES (?, ?, ?, 'submitted', ?, ?, NOW()) RETURNING id`,
    args: [parseInt(run_id), submitter_id, submitter_name, JSON.stringify(data), invitation_id],
  });
}

/** Form name + settings for a run (success message / redirect config). */
export async function getFormSettingsByRunId(run_id) {
  return db.execute({
    sql: "SELECT f.name, f.settings FROM platform_forms f JOIN platform_form_runs r ON r.form_id = f.id WHERE r.id = ?",
    args: [parseInt(run_id)],
  });
}

/** Full form row by id (background automation payload). */
export async function getFormById(form_id) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [form_id],
  });
}

// ---------------------------------------------------------------------------
// Public draft (api/s/public-draft) — 6 queries
// ---------------------------------------------------------------------------

/** Active run id resolved from a public slug (draft save flow). */
export async function getDraftRunIdByPublicSlug(slug) {
  return db.execute({
    sql: "SELECT id FROM platform_form_runs WHERE public_slug = ? AND status = 'active'",
    args: [slug],
  });
}

/** Existing draft row id for a run + submitter (draft upsert check). */
export async function getDraftBySubmitter(run_id, submitter_id) {
  return db.execute({
    sql: "SELECT id FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? AND status = 'draft'",
    args: [parseInt(run_id), submitter_id],
  });
}

/** Overwrite an existing draft's data. */
export async function updateDraftData(data, draft_id) {
  return db.execute({
    sql: "UPDATE platform_form_submissions SET data = ?, updated_at = NOW() WHERE id = ?",
    args: [JSON.stringify(data), draft_id],
  });
}

/** Insert a new draft submission (returns its id). */
export async function insertDraftSubmission(run_id, submitter_id, data) {
  return db.execute({
    sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, submitted_at, updated_at)
            VALUES (?, ?, 'Draft', 'draft', ?, NULL, NOW()) RETURNING id`,
    args: [parseInt(run_id), submitter_id, JSON.stringify(data)],
  });
}

/** Run id resolved from a public slug (draft retrieval — any run status). */
export async function getRunIdByPublicSlug(slug) {
  return db.execute({
    sql: "SELECT id FROM platform_form_runs WHERE public_slug = ?",
    args: [slug],
  });
}

/** Most recently updated draft data for a run + submitter. */
export async function getLatestDraftData(run_id, submitter_id) {
  return db.execute({
    sql: "SELECT data FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? AND status = 'draft' ORDER BY updated_at DESC LIMIT 1",
    args: [parseInt(run_id), submitter_id],
  });
}

// ---------------------------------------------------------------------------
// Public run (api/s/public-run) — 4 queries
// ---------------------------------------------------------------------------

/** Active public run joined with its form (slug-only lookup). */
export async function getPublicRunBySlug(slug) {
  return db.execute({
    sql: "SELECT r.id, r.name, r.description, r.status, r.closes_at, r.public_slug, r.form_id, f.name as form_name, f.description as form_description FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.public_slug = ? AND r.status = 'active'",
    args: [slug],
  });
}

/** Sections of a form, in display order. */
export async function getSectionsByFormId(form_id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_sections WHERE form_id = ? ORDER BY sort_order",
    args: [form_id],
  });
}

/** Fields of a form, in display order. */
export async function getFieldsByFormId(form_id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_fields WHERE form_id = ? ORDER BY sort_order",
    args: [form_id],
  });
}

/** Family name assigned to a run as a group target. */
export async function getGroupNameForRun(run_id) {
  return db.execute({
    sql: "SELECT f.name FROM platform_form_run_assignments a JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT)) WHERE a.run_id = ? AND a.target_type = 'group' LIMIT 1",
    args: [parseInt(run_id)],
  });
}

// ---------------------------------------------------------------------------
// Venture invitations (api/platform/venture-invitations) — 6 queries
// ---------------------------------------------------------------------------

/** Full run row by id (explicit run_id on the invite request). */
export async function getRunById(run_id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [run_id],
  });
}

/** PM assigned to a program (PM scope check for invitations). */
export async function getProgramAssignedPmId(program_id) {
  return db.execute({
    sql: "SELECT assigned_pm_id FROM v2_programs WHERE id::text = ?",
    args: [program_id],
  });
}

/** Contact identity (cid/name/email) for a participant invitee. */
export async function getContactByCid(contact_id) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE cid = ?",
    args: [contact_id],
  });
}

/** Most recent program enrollment for a participant (invite fallback). */
export async function getParticipantProgramByContactId(contact_id) {
  return db.execute({
    sql: "SELECT program_id FROM participant_programs WHERE participant_id = ? ORDER BY assigned_at DESC LIMIT 1",
    args: [contact_id],
  });
}

/** Full team row by id (team-channel invites). */
export async function getTeamById(team_id) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE id::text = ?",
    args: [team_id],
  });
}

/** Contact identity (cid/name/email) for a team-lead invitee. */
export async function getLeadContactByCid(lead_cid) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE cid = ?",
    args: [lead_cid],
  });
}

// ---------------------------------------------------------------------------
// Venture invitation token (api/platform/venture-invitations/[token]) — 1 query
// ---------------------------------------------------------------------------

/** Run id/name/slug for an invitation (resolves the run URL). */
export async function getVentureInvitationRunById(run_id) {
  return db.execute({
    sql: "SELECT id, name, public_slug FROM platform_form_runs WHERE id = ?",
    args: [run_id],
  });
}
