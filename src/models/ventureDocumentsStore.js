/**
 * Venture pitch deck & data room — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/documents`: the document catalogue
 * and versions, the schema-compat ALTERs a first upload runs, the secure-share
 * rows and the access logs.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Documents ────────────────────────────────────────────────────────────────

/** A Venture's live documents (optional filters), newest first. */
export function selectDocuments(ventureId, { category, isPitchDeck, search, visibility } = {}) {
  let sql = "SELECT id, name as title, name, description, document_type, category, file_name, file_size, file_type, file_url, thumbnail_url, is_pitch_deck, approval_status, created_at, updated_at, venture_id FROM venture_documents WHERE venture_id=? AND is_deleted = false";
  const args = [ventureId];
  if (category) { sql += " AND category=?"; args.push(category); }
  if (isPitchDeck !== undefined) { sql += " AND is_pitch_deck=?"; args.push(isPitchDeck?1:0); }
  if (search) { sql += " AND (name ILIKE ? OR description ILIKE ?)"; args.push(`%${search}%`, `%${search}%`); }
  // Restrict visibility based on role (null = show all)
  if (visibility && Array.isArray(visibility) && visibility.length > 0) {
    sql += ` AND approval_status IN (${visibility.map(()=>'?').join(',')})`;
    args.push(...visibility);
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** One document row. */
export function selectDocumentById(docId) {
  return db.execute({ sql: "SELECT * FROM venture_documents WHERE id=?", args: [docId] });
}

/** A document's versions, newest first. */
export function selectDocumentVersions(docId) {
  return db.execute({ sql: "SELECT * FROM venture_document_versions WHERE document_id=? ORDER BY version_number DESC", args: [docId] });
}

/** The id of an existing document with the same file name in a Venture. */
export function selectDocumentByFileName(ventureId, fileName) {
  return db.execute({ sql: "SELECT id FROM venture_documents WHERE venture_id=? AND file_name=?", args: [ventureId, fileName] });
}

/** Insert one document, returning its id. */
export function insertDocument({
  ventureId, title, description, documentType, category, fileName, fileSize, fileType,
  fileUrl, thumbnailUrl, isPitchDeck, uploadedBy,
}) {
  return db.execute({
    sql: `INSERT INTO venture_documents (venture_id, name, description, document_type, category, file_name, file_size, file_type, file_url, storage_path, thumbnail_url, is_pitch_deck, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [ventureId, title, description, documentType, category, fileName, fileSize, fileType, fileUrl, fileUrl, thumbnailUrl, isPitchDeck, uploadedBy],
  });
}

/** Apply a computed SET list to a document. */
export function updateDocumentColumns(sets, args) {
  return db.execute({ sql: `UPDATE venture_documents SET ${sets.join(",")} WHERE id=?`, args });
}

/** Delete one document. */
export function deleteDocumentRow(docId) {
  return db.execute({ sql: "DELETE FROM venture_documents WHERE id=?", args: [docId] });
}

// ── Schema-compat ALTERs (one per statement) ─────────────────────────────────

/** ALTER: add `version_number` to the version table. */
export function alterDocumentVersionsAddVersionNumber() {
  return db.execute({ sql: "ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS version_number INTEGER" });
}

/** ALTER: add `version` to the version table. */
export function alterDocumentVersionsAddVersion() {
  return db.execute({ sql: "ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS version INTEGER" });
}

/** ALTER: add `file_name` to the version table. */
export function alterDocumentVersionsAddFileName() {
  return db.execute({ sql: "ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS file_name TEXT" });
}

/** ALTER: add `file_size` to the version table. */
export function alterDocumentVersionsAddFileSize() {
  return db.execute({ sql: "ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS file_size BIGINT" });
}

/** ALTER: add `change_notes` to the version table. */
export function alterDocumentVersionsAddChangeNotes() {
  return db.execute({ sql: "ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS change_notes TEXT" });
}

/** ALTER: add `storage_path` to the version table. */
export function alterDocumentVersionsAddStoragePath() {
  return db.execute({ sql: "ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS storage_path TEXT" });
}

// ── Document versions ────────────────────────────────────────────────────────

/** Insert a document's first version (v1). */
export function insertDocumentVersionInitial(docId, fileName, fileSize, fileUrl, uploadedBy) {
  return db.execute({ sql: `INSERT INTO venture_document_versions (document_id, version_number, version, file_name, file_size, file_url, storage_path, uploaded_by, change_notes) VALUES (?, 1, 1, ?, ?, ?, ?, ?, 'v1')`, args: [docId, fileName, fileSize, fileUrl, fileUrl, uploadedBy] });
}

/** Insert the next version of a document. */
export function insertDocumentVersionNext(docId, nextVersion, fileName, fileSize, fileUrl, uploadedBy, changeNotes) {
  return db.execute({ sql: `INSERT INTO venture_document_versions (document_id, version, file_name, file_size, file_url, uploaded_by, change_notes) VALUES (?, ?, ?, ?, ?, ?, ?)`, args: [docId, nextVersion, fileName, fileSize, fileUrl, uploadedBy, changeNotes] });
}

// ── Secure sharing ───────────────────────────────────────────────────────────

/** Insert one document share, returning its id. */
export function insertDocumentShare({
  documentId, ventureId, token, sharedWithEmail, sharedWithName, accessType, expiresAt, maxDownloads, createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO venture_document_shares (document_id, venture_id, share_token, shared_with_email, shared_with_name, access_type, expires_at, max_downloads, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [documentId, ventureId, token, sharedWithEmail, sharedWithName, accessType, expiresAt, maxDownloads, createdBy],
  });
}

/** Revoke one share, scoped by a caller-built venture predicate. */
export function revokeShareScoped(shareId, scopeSql, ids) {
  return db.execute({
    sql: `UPDATE venture_document_shares SET is_revoked=TRUE, updated_at=NOW() WHERE id=? AND (${scopeSql})`,
    args: [shareId, ...ids],
  });
}

/** A document's access logs, newest first. */
export function selectAccessLogs(documentId) {
  return db.execute({ sql: "SELECT * FROM venture_document_access_logs WHERE document_id=? ORDER BY created_at DESC LIMIT 50", args: [documentId] });
}

/** A document's shares, newest first. */
export function selectDocumentShares(documentId) {
  return db.execute({ sql: "SELECT * FROM venture_document_shares WHERE document_id=? ORDER BY created_at DESC", args: [documentId] });
}
