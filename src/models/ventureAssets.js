import db from "@/lib/db";

/**
 * VentureAssets model — data access for the venture document/governance
 * controllers (`src/app/api/ventures/[id]/documents/**`, `coaching`,
 * `advisors`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * When a query duplicates another (same table, same shape), it is still kept as
 * its own function (1:1 extraction per occurrence) — see docs/MVC_REFACTOR.md §4.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ───────────────────────────────────────────────────────────────────────────
// documents/route.js — document vault controller (5 queries)
// ───────────────────────────────────────────────────────────────────────────

/** Internal ventures.id for a VNT code — resolveVentureDbId helper (documents controller). */
export async function getVentureIdByCode(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** VNT code for an internal ventures.id — resolveVentureCode helper (documents controller). */
export async function getVentureCodeById(idOrCode) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE id = ?",
    args: [idOrCode],
  });
}

/** Founder-membership gate used for documents visibility (GET list). */
export async function isFounderForDocumentVisibility(code, cid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1",
    args: [code, cid],
  });
}

/** Founder-membership gate for the POST action="transition" branch. SQL identical to isFounderForDocumentVisibility — kept per occurrence. */
export async function isFounderForDocumentStatusTransition(code, cid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1",
    args: [code, cid],
  });
}

/** Update a document's approval_status (POST action="transition"). */
export async function updateDocumentApprovalStatus(approvalStatus, documentId, ventureId) {
  return db.execute({
    sql: "UPDATE venture_documents SET approval_status = ?, updated_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [approvalStatus, documentId, ventureId],
  });
}

// ───────────────────────────────────────────────────────────────────────────
// documents/[docId]/permissions/route.js — document permissions controller (8 queries)
// ───────────────────────────────────────────────────────────────────────────

/** Internal ventures.id for a VNT code — resolveVentureDbId helper (permissions controller). SQL identical to getVentureIdByCode — kept per occurrence. */
export async function getVentureIdByCodeForDocumentPermissions(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** VNT code for an internal ventures.id — resolveVentureCode helper (permissions controller). SQL identical to getVentureCodeById — kept per occurrence. */
export async function getVentureCodeByIdForDocumentPermissions(idOrCode) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE id = ?",
    args: [idOrCode],
  });
}

/** Document existence within the venture (GET). */
export async function getDocumentForPermissions(docId, dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?",
    args: [docId, dbId],
  });
}

/** Permission rows for a document (GET). */
export async function listDocumentPermissions(docId) {
  return db.execute({
    sql: "SELECT * FROM venture_document_permissions WHERE document_id = ?",
    args: [docId],
  });
}

/** Document existence within the venture (PATCH). SQL identical to getDocumentForPermissions — kept per occurrence. */
export async function getDocumentForPermissionsUpdate(docId, dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?",
    args: [docId, dbId],
  });
}

/** Founder-membership gate for editing permissions (PATCH). SQL identical to isFounderForDocumentVisibility — kept per occurrence. */
export async function isFounderForDocumentPermissions(code, cid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1",
    args: [code, cid],
  });
}

/** Remove a document permission row (access_level "none"). */
export async function deleteDocumentPermission(docId, roleScope) {
  return db.execute({
    sql: "DELETE FROM venture_document_permissions WHERE document_id = ? AND role_scope = ?",
    args: [docId, roleScope],
  });
}

/** Insert or update a document permission row (access_level view/edit). */
export async function upsertDocumentPermission(docId, roleScope, accessLevel) {
  return db.execute({
    sql: `INSERT INTO venture_document_permissions (document_id, role_scope, access_level) VALUES (?, ?, ?)
              ON CONFLICT (document_id, role_scope) DO UPDATE SET access_level = EXCLUDED.access_level`,
    args: [docId, roleScope, accessLevel],
  });
}

// ───────────────────────────────────────────────────────────────────────────
// documents/[docId]/versions/route.js — document versions controller (8 queries)
// ───────────────────────────────────────────────────────────────────────────

/** Internal ventures.id for a VNT code (GET). */
export async function getVentureIdByCodeForVersions(id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id=?",
    args: [id],
  });
}

/** Document existence within the venture (GET). SQL identical to getDocumentForPermissions — kept per occurrence. */
export async function getDocumentForVersions(docId, dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?",
    args: [docId, dbId],
  });
}

/** Version history for a document, newest version first (GET). */
export async function listDocumentVersions(docId) {
  return db.execute({
    sql: "SELECT * FROM venture_document_versions WHERE document_id = ? ORDER BY version_number DESC",
    args: [docId],
  });
}

/** Internal ventures.id for a VNT code (POST). SQL identical to getVentureIdByCodeForVersions — kept per occurrence. */
export async function getVentureIdByCodeForVersionsUpload(id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id=?",
    args: [id],
  });
}

/** Document existence within the venture (POST). SQL identical to getDocumentForVersions — kept per occurrence. */
export async function getDocumentForVersionsUpload(docId, dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?",
    args: [docId, dbId],
  });
}

/** Highest existing version_number for a document (POST). */
export async function getDocumentMaxVersion(docId) {
  return db.execute({
    sql: "SELECT COALESCE(MAX(version_number), 0) as max_version FROM venture_document_versions WHERE document_id = ?",
    args: [docId],
  });
}

/** Archive a new file as a document version (POST). */
export async function insertDocumentVersion({ document_id, next_version, storage_path, file_url, version_notes, uploaded_by }) {
  return db.execute({
    sql: "INSERT INTO venture_document_versions (document_id, version_number, storage_path, file_url, version_notes, uploaded_by) VALUES (?,?,?,?,?,?)",
    args: [document_id, next_version, storage_path || file_url, file_url, version_notes || null, uploaded_by],
  });
}

/** Point the parent document at the newly uploaded file (POST). */
export async function updateDocumentVersionPointer({ storage_path, file_url, document_id }) {
  return db.execute({
    sql: "UPDATE venture_documents SET storage_path = ?, file_url = ?, updated_at = NOW() WHERE id = ?",
    args: [storage_path || file_url, file_url, document_id],
  });
}

// ───────────────────────────────────────────────────────────────────────────
// documents/[docId]/reviews/route.js — document reviews controller (6 queries)
// ───────────────────────────────────────────────────────────────────────────

/** Internal ventures.id for a VNT code (GET). SQL identical to getVentureIdByCodeForVersions — kept per occurrence. */
export async function getVentureIdByCodeForReviews(id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id=?",
    args: [id],
  });
}

/** Document existence within the venture (GET). SQL identical to getDocumentForPermissions — kept per occurrence. */
export async function getDocumentForReviews(docId, dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?",
    args: [docId, dbId],
  });
}

/** Reviews for a document, newest first (GET). */
export async function listDocumentReviews(docId) {
  return db.execute({
    sql: "SELECT * FROM venture_document_reviews WHERE document_id = ? ORDER BY created_at DESC",
    args: [docId],
  });
}

/** Internal ventures.id for a VNT code (POST). SQL identical to getVentureIdByCodeForReviews — kept per occurrence. */
export async function getVentureIdByCodeForReviewsSubmit(id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id=?",
    args: [id],
  });
}

/** Document existence within the venture (POST). SQL identical to getDocumentForReviews — kept per occurrence. */
export async function getDocumentForReviewsSubmit(docId, dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?",
    args: [docId, dbId],
  });
}

/** Add a review (comment / approved / revision_requested) to a document (POST). */
export async function insertDocumentReview({ document_id, reviewer_id, comment, decision }) {
  return db.execute({
    sql: "INSERT INTO venture_document_reviews (document_id, reviewer_id, comment, decision) VALUES (?,?,?,?)",
    args: [document_id, reviewer_id, comment || null, decision],
  });
}

// ───────────────────────────────────────────────────────────────────────────
// documents/[docId]/transition/route.js — document status transition controller (6 queries)
// ───────────────────────────────────────────────────────────────────────────

/** Internal ventures.id for a VNT code — resolveVentureDbId helper (transition controller). SQL identical to getVentureIdByCode — kept per occurrence. */
export async function getVentureIdByCodeForTransition(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** VNT code for an internal ventures.id — resolveVentureCode helper (transition controller). SQL identical to getVentureCodeById — kept per occurrence. */
export async function getVentureCodeByIdForTransition(idOrCode) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE id = ?",
    args: [idOrCode],
  });
}

/** Internal ventures.id for a VNT code (PATCH). SQL identical to getVentureIdByCodeForVersions — kept per occurrence. */
export async function getVentureIdByCodeForTransitionStatus(id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id=?",
    args: [id],
  });
}

/** Document existence within the venture (PATCH). SQL identical to getDocumentForPermissions — kept per occurrence. */
export async function getDocumentForTransition(docId, dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?",
    args: [docId, dbId],
  });
}

/** Founder-membership gate for transitioning document status (PATCH). SQL identical to isFounderForDocumentVisibility — kept per occurrence. */
export async function isFounderForDocumentTransition(code, cid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1",
    args: [code, cid],
  });
}

/** Update a document's approval_status (PATCH). SQL identical to updateDocumentApprovalStatus — kept per occurrence. */
export async function updateDocumentStatusForTransition(approvalStatus, docId, dbId) {
  return db.execute({
    sql: "UPDATE venture_documents SET approval_status = ?, updated_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [approvalStatus, docId, dbId],
  });
}

// ───────────────────────────────────────────────────────────────────────────
// coaching/route.js — venture coaching sessions controller (9 queries)
// ───────────────────────────────────────────────────────────────────────────

/** Internal ventures.id for a VNT code — resolveVentureDbId helper (coaching controller). SQL identical to getVentureIdByCode — kept per occurrence. */
export async function getVentureIdByCodeForCoaching(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Coaching sessions for a venture with advisor names, newest first (GET). */
export async function listCoachingSessions(ventureId) {
  return db.execute({
    sql: "SELECT vcs.*, c.name as advisor_name FROM venture_coaching_sessions vcs LEFT JOIN contacts c ON vcs.advisor_contact_id = c.cid WHERE vcs.venture_id = ? ORDER BY vcs.session_date DESC",
    args: [ventureId],
  });
}

/** Dev migration: ensure the follow_up_date column exists (POST). */
export async function addCoachingFollowUpDateColumn() {
  return db.execute({
    sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS follow_up_date DATE",
  });
}

/** Dev migration: ensure the start_time column exists (POST). */
export async function addCoachingStartTimeColumn() {
  return db.execute({
    sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS start_time VARCHAR",
  });
}

/** Dev migration: ensure the location column exists (POST). */
export async function addCoachingLocationColumn() {
  return db.execute({
    sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS location VARCHAR",
  });
}

/** Dev migration: ensure the meeting_link column exists (POST). */
export async function addCoachingMeetingLinkColumn() {
  return db.execute({
    sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS meeting_link TEXT",
  });
}

/** Schedule a new coaching session for a venture (POST). */
export async function insertCoachingSession({ venture_id, advisor_contact_id, session_date, start_time, location, meeting_link, notes, observations, recommendations, follow_up_date }) {
  return db.execute({
    sql: "INSERT INTO venture_coaching_sessions (venture_id, advisor_contact_id, session_date, start_time, location, meeting_link, notes, observations, recommendations, follow_up_date) VALUES (?,?,?,?,?,?,?,?,?,?)",
    args: [venture_id, advisor_contact_id || null, session_date || null, start_time || null, location || null, meeting_link || null, notes || null, observations || null, recommendations || null, follow_up_date || null],
  });
}

/** Dev migration: ensure the status column exists (PATCH status branch). */
export async function addCoachingStatusColumn() {
  return db.execute({
    sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'",
  });
}

/** Apply the caller-built column updates to a coaching session (PATCH). */
export async function updateCoachingSessionFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_coaching_sessions SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

// ───────────────────────────────────────────────────────────────────────────
// advisors/route.js — venture advisors controller (6 queries)
// ───────────────────────────────────────────────────────────────────────────

/** Internal ventures.id for a VNT code — resolveVentureDbId helper (advisors controller). SQL identical to getVentureIdByCode — kept per occurrence. */
export async function getVentureIdByCodeForAdvisors(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Active advisors for a venture with contact details, primary first (GET). */
export async function listVentureAdvisors(ventureId) {
  return db.execute({
    sql: "SELECT va.*, c.name as advisor_name, c.email as advisor_email FROM venture_advisors va LEFT JOIN contacts c ON va.advisor_contact_id = c.cid WHERE va.venture_id = ? AND va.removed_at IS NULL ORDER BY va.is_primary DESC",
    args: [ventureId],
  });
}

/** Add an advisor or resurrect a previously removed one (POST). */
export async function upsertVentureAdvisor({ venture_id, advisor_contact_id, is_primary, assigned_by }) {
  return db.execute({
    sql: "INSERT INTO venture_advisors (venture_id, advisor_contact_id, is_primary, assigned_by) VALUES (?,?,?,?) ON CONFLICT (venture_id, advisor_contact_id) DO UPDATE SET removed_at = NULL, assigned_by = EXCLUDED.assigned_by",
    args: [venture_id, advisor_contact_id, is_primary || false, assigned_by],
  });
}

/** Soft-remove an advisor (PATCH action="remove"). */
export async function removeVentureAdvisor(advisorId, ventureId) {
  return db.execute({
    sql: "UPDATE venture_advisors SET removed_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [advisorId, ventureId],
  });
}

/** Clear the current primary advisor before promoting another (PATCH). */
export async function clearVenturePrimaryAdvisor(ventureId) {
  return db.execute({
    sql: "UPDATE venture_advisors SET is_primary = false WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Promote an advisor to primary (PATCH). */
export async function setVenturePrimaryAdvisor(advisorId, ventureId) {
  return db.execute({
    sql: "UPDATE venture_advisors SET is_primary = true WHERE id = ? AND venture_id = ?",
    args: [advisorId, ventureId],
  });
}
