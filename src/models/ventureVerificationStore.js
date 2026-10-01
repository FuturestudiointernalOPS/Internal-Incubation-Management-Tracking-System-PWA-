/**
 * Venture verification (the Data bank) — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/verification`: the verification
 * record, its items, documents, history, reviews and comments, the sign-off
 * writes, and the document-version history.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Verification record + its parts ──────────────────────────────────────────

/** The verification row of a Venture, or empty rows if none exists yet. */
export function selectVerification(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_verifications WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Create the draft verification row for a Venture. */
export function insertVerification(ventureId) {
  return db.execute({
    sql: "INSERT INTO venture_verifications (venture_id, status) VALUES (?, 'draft')",
    args: [ventureId],
  });
}

/** One verification row by id within its Venture. */
export function selectVerificationByIdAndVenture(verificationId, ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_verifications WHERE id = ? AND venture_id = ?",
    args: [verificationId, ventureId],
  });
}

/** The items of a verification. */
export function selectVerificationItems(verificationId) {
  return db.execute({
    sql: "SELECT * FROM venture_verification_items WHERE verification_id = ?",
    args: [verificationId],
  });
}

/** The item of a verification for one category. */
export function selectVerificationItemByCategory(verificationId, category) {
  return db.execute({
    sql: "SELECT * FROM venture_verification_items WHERE verification_id = ? AND category = ?",
    args: [verificationId, category],
  });
}

/** Create a pending item for a newly-added document type (idempotent). */
export function insertVerificationItem(verificationId, category) {
  return db.execute({
    sql: `INSERT INTO venture_verification_items (verification_id, category, status)
          VALUES (?, ?, 'pending')
          ON CONFLICT (verification_id, category) DO NOTHING`,
    args: [verificationId, category],
  });
}

/** The documents of a verification, newest first. */
export function selectVerificationDocuments(verificationId) {
  return db.execute({
    sql: `SELECT vvd.* FROM venture_verification_documents vvd WHERE vvd.verification_id = ? ORDER BY vvd.uploaded_at DESC`,
    args: [verificationId],
  });
}

/** The history of a verification, newest first. */
export function selectVerificationHistory(verificationId) {
  return db.execute({
    sql: "SELECT * FROM venture_verification_history WHERE verification_id = ? ORDER BY created_at DESC",
    args: [verificationId],
  });
}

/** The reviews of a verification, newest first. */
export function selectVerificationReviews(verificationId) {
  return db.execute({
    sql: "SELECT * FROM venture_verification_reviews WHERE verification_id = ? ORDER BY created_at DESC",
    args: [verificationId],
  });
}

/** The comments of a verification, oldest first. */
export function selectVerificationComments(verificationId) {
  return db.execute({
    sql: "SELECT * FROM venture_verification_comments WHERE verification_id = ? ORDER BY created_at ASC",
    args: [verificationId],
  });
}

/** Whether an email is a registered founder of the Venture. */
export function selectVerificationFounderIdByEmail(ventureId, email) {
  return db.execute({
    sql: "SELECT id FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, email],
  });
}

// ── Sign-off writes ──────────────────────────────────────────────────────────

/** Move a verification to pending_review at submission time. */
export function submitVerificationRow(verificationId, now) {
  return db.execute({
    sql: "UPDATE venture_verifications SET status = 'pending_review', submitted_at = ?, updated_at = ? WHERE id = ?",
    args: [now, now, verificationId],
  });
}

/** Reopen a rejected verification for a new review round. */
export function reopenVerificationRow(verificationId, now) {
  return db.execute({
    sql: "UPDATE venture_verifications SET status = 'pending_review', submitted_at = ?, reviewed_by = NULL, reviewed_at = NULL, reviewer_notes = NULL, updated_at = ? WHERE id = ?",
    args: [now, now, verificationId],
  });
}

/** Apply a reviewer's decision to the whole verification. */
export function updateVerificationRow(verificationId, status, reviewerCid, now, notes) {
  return db.execute({
    sql: "UPDATE venture_verifications SET status = ?, reviewed_by = ?, reviewed_at = ?, reviewer_notes = ?, updated_at = ? WHERE id = ?",
    args: [status, reviewerCid, now, notes, now, verificationId],
  });
}

/** Move pending/rejected items to under_review at submission time. */
export function setVerificationItemUnderReview(itemId, now) {
  return db.execute({
    sql: "UPDATE venture_verification_items SET status = 'under_review', updated_at = ? WHERE id = ?",
    args: [now, itemId],
  });
}

/** Reset a rejected item back to pending on resubmission. */
export function resetVerificationItemToPending(itemId, now) {
  return db.execute({
    sql: "UPDATE venture_verification_items SET status = 'pending', notes = NULL, reviewed_by = NULL, reviewed_at = NULL, updated_at = ? WHERE id = ?",
    args: [now, itemId],
  });
}

/** Apply a reviewer's decision to one item. */
export function updateVerificationItemStatus(itemId, status, notes, reviewerCid, now) {
  return db.execute({
    sql: "UPDATE venture_verification_items SET status = ?, notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
    args: [status, notes, reviewerCid, now, now, itemId],
  });
}

/** Pass every non-reviewed item when the verification is verified. */
export function verifyAllPendingItems(verificationId, now) {
  return db.execute({
    sql: "UPDATE venture_verification_items SET status = 'verified', updated_at = ? WHERE verification_id = ? AND status IN ('pending', 'under_review')",
    args: [now, verificationId],
  });
}

// ── History writes (one function per statement) ──────────────────────────────

/** History row for a first submission. */
export function insertVerificationSubmittedHistory(verificationId, previousStatus, actorCid, actorName, now) {
  return db.execute({
    sql: `INSERT INTO venture_verification_history (verification_id, action, previous_status, new_status, actor_cid, actor_name, created_at)
          VALUES (?, 'VERIFICATION_SUBMITTED', ?, 'pending_review', ?, ?, ?)`,
    args: [verificationId, previousStatus, actorCid, actorName, now],
  });
}

/** History row for a resubmission. */
export function insertVerificationResubmittedHistory(verificationId, actorCid, actorName, now) {
  return db.execute({
    sql: `INSERT INTO venture_verification_history (verification_id, action, previous_status, new_status, actor_cid, actor_name, created_at)
          VALUES (?, 'VERIFICATION_RESUBMITTED', 'rejected', 'pending_review', ?, ?, ?)`,
    args: [verificationId, actorCid, actorName, now],
  });
}

/** History row for one item's reviewer update (carries metadata JSON). */
export function insertVerificationItemUpdatedHistory({
  verificationId, previousStatus, newStatus, reviewerCid, reviewerName, notes, metadataJson, now,
}) {
  return db.execute({
    sql: `INSERT INTO venture_verification_history (verification_id, action, previous_status, new_status, actor_cid, actor_name, notes, metadata, created_at)
          VALUES (?, 'ITEM_UPDATED', ?, ?, ?, ?, ?, ?::jsonb, ?)`,
    args: [verificationId, previousStatus, newStatus, reviewerCid, reviewerName, notes, metadataJson, now],
  });
}

/** History row for a whole-verification status change. */
export function insertVerificationStatusHistory({
  verificationId, actionKey, previousStatus, newStatus, reviewerCid, reviewerName, notes, now,
}) {
  return db.execute({
    sql: `INSERT INTO venture_verification_history (verification_id, action, previous_status, new_status, actor_cid, actor_name, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [verificationId, actionKey, previousStatus, newStatus, reviewerCid, reviewerName, notes, now],
  });
}

// ── Documents + versions ─────────────────────────────────────────────────────

/** Insert one verification document, returning its id. */
export function insertVerificationDocument({
  verificationId, category, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy,
}) {
  return db.execute({
    sql: `INSERT INTO venture_verification_documents (verification_id, category, document_type, file_name, file_size, file_type, file_url, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [verificationId, category, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy],
  });
}

/** Delete one verification document. */
export function deleteVerificationDocumentRow(documentId) {
  return db.execute({ sql: "DELETE FROM venture_verification_documents WHERE id = ?", args: [documentId] });
}

/** Create the document-versions table when the schema predates it. */
export function createVerificationVersionsTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS venture_verification_document_versions (
            id SERIAL PRIMARY KEY,
            document_id INTEGER NOT NULL REFERENCES venture_verification_documents(id) ON DELETE CASCADE,
            version_number INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_size BIGINT,
            file_type TEXT,
            file_url TEXT NOT NULL,
            version_notes TEXT,
            uploaded_by TEXT,
            uploaded_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(document_id, version_number)
          )`,
    args: [],
  });
}

/** The verification document of ONE Venture, or empty rows. */
export function selectVerificationDocumentForVenture(ventureId, documentId) {
  return db.execute({
    sql: `SELECT vvd.* FROM venture_verification_documents vvd
          JOIN venture_verifications vv ON vv.id = vvd.verification_id
          WHERE vvd.id = ? AND vv.venture_id = ?`,
    args: [documentId, ventureId],
  });
}

/** Every version of one document, oldest first. */
export function selectVerificationDocumentVersions(documentId) {
  return db.execute({
    sql: `SELECT * FROM venture_verification_document_versions
          WHERE document_id = ? ORDER BY version_number ASC`,
    args: [documentId],
  });
}

/** The highest version number recorded for a document. */
export function selectMaxVerificationDocumentVersion(documentId) {
  return db.execute({
    sql: `SELECT COALESCE(MAX(version_number), 0) AS max_version
          FROM venture_verification_document_versions WHERE document_id = ?`,
    args: [documentId],
  });
}

/** Archive a document's current file as version 1. */
export function insertVerificationDocumentVersionOne(documentId, fileName, fileSize, fileType, fileUrl, uploadedBy) {
  return db.execute({
    sql: `INSERT INTO venture_verification_document_versions
          (document_id, version_number, file_name, file_size, file_type, file_url, uploaded_by)
          VALUES (?, 1, ?, ?, ?, ?, ?)`,
    args: [documentId, fileName, fileSize, fileType, fileUrl, uploadedBy],
  });
}

/** Record the next version of a document. */
export function insertVerificationDocumentVersion({
  documentId, versionNumber, fileName, fileSize, fileType, fileUrl, versionNotes, uploadedBy,
}) {
  return db.execute({
    sql: `INSERT INTO venture_verification_document_versions
          (document_id, version_number, file_name, file_size, file_type, file_url, version_notes, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [documentId, versionNumber, fileName, fileSize, fileType, fileUrl, versionNotes, uploadedBy],
  });
}

/** Point a document at a newly recorded file (the live pointer). */
export function updateVerificationDocumentLive(documentId, fileName, fileSize, fileType, fileUrl, uploadedBy) {
  return db.execute({
    sql: `UPDATE venture_verification_documents
          SET file_name = ?, file_size = ?, file_type = ?, file_url = ?, uploaded_by = ?, uploaded_at = NOW()
          WHERE id = ?`,
    args: [fileName, fileSize, fileType, fileUrl, uploadedBy, documentId],
  });
}

/** Add a comment to a verification. */
export function insertVerificationComment({ verificationId, authorType, authorCid, authorName, message }) {
  return db.execute({
    sql: `INSERT INTO venture_verification_comments (verification_id, author_type, author_cid, author_name, message) VALUES (?, ?, ?, ?, ?)`,
    args: [verificationId, authorType, authorCid, authorName, message],
  });
}
