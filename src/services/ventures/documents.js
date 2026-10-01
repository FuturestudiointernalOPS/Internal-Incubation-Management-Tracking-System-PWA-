/**
 * VENTURE PITCH DECK & DATA ROOM.
 *
 * The document catalogue (list / read with versions, upload with the
 * duplicate guard and schema-compat ALTERs, update with versioning, delete) and
 * the secure sharing (create link, scoped revoke, access logs, shares).
 *
 * The decisions — the visibility filter, the duplicate rule, which version table
 * gets patched, how a share token/expiry are built and the revoke scope — live
 * here; every statement is in `@/models/ventureDocumentsStore`. Nothing here runs
 * SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) — see
 * docs/LAYER_SPLIT.md.
 */

import {
  selectDocuments,
  selectDocumentById,
  selectDocumentVersions,
  selectDocumentByFileName,
  insertDocument,
  updateDocumentColumns,
  deleteDocumentRow,
  alterDocumentVersionsAddVersionNumber,
  alterDocumentVersionsAddVersion,
  alterDocumentVersionsAddFileName,
  alterDocumentVersionsAddFileSize,
  alterDocumentVersionsAddChangeNotes,
  alterDocumentVersionsAddStoragePath,
  insertDocumentVersionInitial,
  insertDocumentVersionNext,
  insertDocumentShare,
  revokeShareScoped,
  selectAccessLogs,
  selectDocumentShares,
} from "@/models/ventureDocumentsStore";

export async function listDocuments(ventureId, { category, isPitchDeck, search, visibility } = {}) {
  return (await selectDocuments(ventureId, { category, isPitchDeck, search, visibility })).rows || [];
}

export async function getDocument(docId) {
  const [d, v] = await Promise.all([
    selectDocumentById(docId),
    selectDocumentVersions(docId),
  ]);
  if (d.rows.length === 0) return null;
  return { ...d.rows[0], versions: v.rows||[] };
}

export async function uploadDocument({ ventureId, title, description, documentType, category, fileName, fileSize, fileType, fileUrl, thumbnailUrl, isPitchDeck, uploadedBy }) {
  const dup = await selectDocumentByFileName(ventureId, fileName);
  if (dup.rows.length > 0) throw new Error("File already exists. Use update for new version.");
  const id = (await insertDocument({
    ventureId, title: title.trim(), description: description||null, documentType: documentType||"other",
    category: category||"other", fileName, fileSize: fileSize||null, fileType: fileType||null,
    fileUrl, thumbnailUrl: thumbnailUrl||null, isPitchDeck: isPitchDeck?1:0, uploadedBy: uploadedBy||"system",
  })).rows[0]?.id;
  // Ensure version table columns exist (schema compatibility)
  try { await alterDocumentVersionsAddVersionNumber(); } catch {}
  try { await alterDocumentVersionsAddVersion(); } catch {}
  try { await alterDocumentVersionsAddFileName(); } catch {}
  try { await alterDocumentVersionsAddFileSize(); } catch {}
  try { await alterDocumentVersionsAddChangeNotes(); } catch {}
  try { await alterDocumentVersionsAddStoragePath(); } catch {}
  await insertDocumentVersionInitial(id, fileName, fileSize||null, fileUrl, uploadedBy||"system");
  return { id };
}

export async function updateDocument(docId, updates) {
  if (updates.file_url) {
    const doc = (await selectDocumentById(docId)).rows[0];
    if (doc) {
      const nextVersion = (doc.current_version||0) + 1;
      await insertDocumentVersionNext(docId, nextVersion, updates.file_name||doc.file_name, updates.file_size||null, updates.file_url, updates.uploaded_by||"system", updates.change_notes||`v${nextVersion}`);
      updates.current_version = nextVersion;
    }
  }
  const allowed = ["title","description","document_type","category","file_name","file_size","file_type","file_url","thumbnail_url","current_version"];
  const sets = []; const args = [];
  for (const column of allowed) { if (updates[column] !== undefined) { sets.push(`${column}=?`); args.push(updates[column]); } }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at=NOW()"); args.push(docId);
  await updateDocumentColumns(sets, args);
  return { updated: true };
}

export async function deleteDocument(docId) {
  await deleteDocumentRow(docId);
  return { success: true };
}

// ─── Secure Sharing ────────────────────────────────────────────────────────

export async function createShareLink({ documentId, ventureId, sharedWithEmail, sharedWithName, accessType, expiresInHours, maxDownloads, createdBy }) {
  const { v4: uuidv4 } = await import("uuid");
  const token = uuidv4();
  const expiresAt = expiresInHours ? new Date(Date.now()+expiresInHours*3600000).toISOString() : null;
  const id = (await insertDocumentShare({
    documentId, ventureId, token, sharedWithEmail: sharedWithEmail||null, sharedWithName: sharedWithName||null,
    accessType: accessType||"read", expiresAt, maxDownloads: maxDownloads||null, createdBy: createdBy||"system",
  })).rows[0]?.id;
  return { id, token, expires_at: expiresAt, share_url: `/api/ventures/share/${token}` };
}

export async function revokeShare(shareId, ventureIds = []) {
  const ids = (Array.isArray(ventureIds) ? ventureIds : [ventureIds]).filter(
    (ventureId) => ventureId !== null && ventureId !== undefined,
  );
  if (ids.length === 0) return { success: false };
  const scope = ids.map(() => "venture_id = ?").join(" OR ");
  await revokeShareScoped(shareId, scope, ids);
  return { success: true };
}

export async function getAccessLogs(documentId) {
  return (await selectAccessLogs(documentId)).rows || [];
}

export async function getDocumentShares(documentId) {
  return (await selectDocumentShares(documentId)).rows || [];
}
