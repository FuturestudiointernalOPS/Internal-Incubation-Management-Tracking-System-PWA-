/**
 * Data Room — document writes.
 *
 * Upload, replace (new version), review, correct metadata, and remove. Every
 * function re-resolves the viewer; the caller's UI is never the authority.
 */

import {
  ensureDataRoomSchema,
  selectDataRoomDocument,
  selectMaxDataRoomVersion,
  insertDataRoomDocument,
  updateDataRoomDocument,
  softDeleteDataRoomDocument,
  insertDataRoomVersion,
  updateDataRoomReview,
  deleteDataRoomVersion,
} from "@/models/ventureDataRoomStore";
import {
  isDataRoomCategory,
  isDataRoomExternalLink,
  isDataRoomReviewDecision,
  isDataRoomStoragePathForVenture,
} from "@/lib/dataRoom";
import { notifyVentureFounders } from "@/services/ventures/activity";
import { deleteEvidenceObject } from "@/lib/ventureEvidence";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";
import { resolveDataRoomViewer } from "./access";
import { audit, cleanText, parseExpiry, refusal, MAX_TITLE, MAX_DESCRIPTION, MAX_NOTES } from "./shared";

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * Remove the bytes a previous upload step placed in this Venture's prefix.
 *
 * The catalogue write is the SECOND step of an upload: by the time a validation
 * refusal happens, the file already exists in the private bucket. Deleting it on
 * the early refusals is what keeps a refused create from leaving an orphan.
 * A path that is not this Venture's is never touched.
 */
async function discardUploadedFile(filePath, ventureId) {
  if (!filePath || !isDataRoomStoragePathForVenture(filePath, ventureId)) return;
  await deleteEvidenceObject(filePath).catch(() => {});
}

/**
 * File a NEW document. `input.file_path` is the private storage path returned
 * by the upload route; `input.file_url` is an optional external link. Exactly
 * one of them must be present.
 */
export async function createDataRoomDocument({ ventureId, session, input, database }) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  const filePath = cleanText(input?.file_path, 1000) || null;
  const externalUrl = cleanText(input?.file_url, 2000) || null;

  const title = cleanText(input?.title, MAX_TITLE);
  if (!title) {
    await discardUploadedFile(filePath, ventureId);
    return refusal(400, "dataRoom.errors.titleRequired");
  }
  if (!isDataRoomCategory(input?.category)) {
    await discardUploadedFile(filePath, ventureId);
    return refusal(400, "dataRoom.errors.categoryInvalid");
  }

  if (!filePath && !externalUrl) return refusal(400, "dataRoom.errors.fileRequired");
  if (filePath && !isDataRoomStoragePathForVenture(filePath, ventureId)) {
    return refusal(400, "dataRoom.errors.fileRequired");
  }
  if (externalUrl && !isDataRoomExternalLink(externalUrl)) {
    await discardUploadedFile(filePath, ventureId);
    return refusal(400, "dataRoom.errors.fileRequired");
  }

  let expiresAt = null;
  try {
    expiresAt = parseExpiry(input?.expires_at);
  } catch (error) {
    await discardUploadedFile(filePath, ventureId);
    return refusal(400, error.message);
  }

  await ensureDataRoomSchema(database);

  const inserted = await insertDataRoomDocument(
    {
      ventureId,
      title,
      description: cleanText(input?.description, MAX_DESCRIPTION) || null,
      category: input.category,
      fileName: cleanText(input?.file_name, 500) || null,
      fileSize: Number.isFinite(Number(input?.file_size)) ? Number(input.file_size) : null,
      fileType: cleanText(input?.file_type, 200) || null,
      storagePath: filePath || externalUrl,
      uploadedBy: session.cid || "system",
      expiresAt,
      isPitchDeck: input?.category === "pitch_deck_business_plan",
    },
    database,
  );
  const documentId = inserted.rows?.[0]?.id;
  if (!documentId) {
    if (filePath) await deleteEvidenceObject(filePath).catch(() => {});
    return refusal(500, "dataRoom.errors.saveFailed");
  }

  // The first upload IS version 1, so the history starts where the document
  // does. If the version row cannot be written the document is soft-deleted:
  // a catalogue entry without a version would read as a broken document.
  try {
    await insertDataRoomVersion(
      {
        documentId,
        versionNumber: 1,
        fileName: cleanText(input?.file_name, 500) || title,
        fileSize: Number.isFinite(Number(input?.file_size)) ? Number(input.file_size) : null,
        fileType: cleanText(input?.file_type, 200) || null,
        storagePath: filePath || externalUrl,
        notes: cleanText(input?.change_notes, MAX_NOTES) || null,
        uploadedBy: session.cid || "system",
      },
      database,
    );
  } catch (_error) {
    await softDeleteDataRoomDocument(documentId, session.cid || "system", database).catch(() => {});
    if (filePath) await deleteEvidenceObject(filePath).catch(() => {});
    return refusal(500, "dataRoom.errors.saveFailed");
  }

  await audit(
    ventureId,
    "DATA_ROOM_DOCUMENT_UPLOADED",
    session,
    { document_id: documentId, category: input.category, version: 1 },
    database,
  );

  return { ok: true, document_id: documentId };
}

/** Replace a document with a newer version. Review state restarts at `uploaded`. */
export async function replaceDataRoomDocument({
  ventureId,
  documentId,
  session,
  input,
  database,
}) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  await ensureDataRoomSchema(database);

  const existing = await selectDataRoomDocument(ventureId, documentId, {}, database);
  const document = existing.rows?.[0];
  if (!document) return refusal(404, "errors.notFound");

  const filePath = cleanText(input?.file_path, 1000) || null;
  const externalUrl = cleanText(input?.file_url, 2000) || null;
  if (!filePath && !externalUrl) return refusal(400, "dataRoom.errors.fileRequired");
  if (filePath && !isDataRoomStoragePathForVenture(filePath, ventureId)) {
    return refusal(400, "dataRoom.errors.fileRequired");
  }

  const maxResult = await selectMaxDataRoomVersion(documentId, database);
  const nextVersion = Number(maxResult.rows?.[0]?.max_version || 0) + 1;

  try {
    await insertDataRoomVersion(
      {
        documentId,
        versionNumber: nextVersion,
        fileName: cleanText(input?.file_name, 500) || document.file_name || "document",
        fileSize: Number.isFinite(Number(input?.file_size)) ? Number(input.file_size) : null,
        fileType: cleanText(input?.file_type, 200) || null,
        storagePath: filePath || externalUrl,
        notes: cleanText(input?.change_notes, MAX_NOTES) || null,
        uploadedBy: session.cid || "system",
      },
      database,
    );

    // The parent row is the live pointer. Verification belongs to the VERSION
    // that was reviewed, so it is cleared here: a new file is never silently
    // inherits the previous version's "verified".
    await updateDataRoomDocument(
      [
        "file_name = ?",
        "file_size = ?",
        "file_type = ?",
        "file_url = ?",
        "storage_path = ?",
        "current_version = ?",
        "review_status = 'uploaded'",
        "reviewer_id = NULL",
        "reviewed_at = NULL",
        "review_notes = NULL",
        "reviewed_version = NULL",
        "updated_at = NOW()",
      ],
      [
        cleanText(input?.file_name, 500) || document.file_name || "document",
        Number.isFinite(Number(input?.file_size)) ? Number(input.file_size) : null,
        cleanText(input?.file_type, 200) || null,
        filePath || externalUrl,
        filePath || externalUrl,
        nextVersion,
        documentId,
      ],
      database,
    );
  } catch (_error) {
    // Compensate: the version row (if it landed) and the new file are removed,
    // so a failed replace never leaves a dangling history entry or an orphan.
    await deleteDataRoomVersion(documentId, nextVersion, database).catch(() => {});
    if (filePath) await deleteEvidenceObject(filePath).catch(() => {});
    return refusal(500, "dataRoom.errors.saveFailed");
  }

  await audit(
    ventureId,
    "DATA_ROOM_VERSION_ADDED",
    session,
    { document_id: documentId, category: document.category, version: nextVersion },
    database,
  );

  return { ok: true, version_number: nextVersion };
}

/** Record a reviewer's decision on the CURRENT version. */
export async function reviewDataRoomDocument({
  ventureId,
  documentId,
  session,
  decision,
  notes,
  database,
}) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canReview) return refusal(403, "errors.insufficientPermissions");

  if (!isDataRoomReviewDecision(decision)) {
    return refusal(400, "dataRoom.errors.decisionInvalid");
  }
  const cleanNotes = cleanText(notes, MAX_NOTES) || null;
  if (decision === "rejected" && !cleanNotes) {
    return refusal(400, "dataRoom.errors.rejectionReasonRequired");
  }

  await ensureDataRoomSchema(database);

  const existing = await selectDataRoomDocument(ventureId, documentId, {}, database);
  const document = existing.rows?.[0];
  if (!document) return refusal(404, "errors.notFound");
  if (document.is_deleted) return refusal(404, "errors.notFound");

  const reviewedVersion = document.current_version || 1;
  await updateDataRoomReview(
    {
      documentId,
      status: decision,
      reviewerId: session.cid || "system",
      notes: cleanNotes,
      reviewedVersion,
    },
    database,
  );

  const actionKey =
    decision === "verified"
      ? "DATA_ROOM_DOCUMENT_VERIFIED"
      : decision === "rejected"
        ? "DATA_ROOM_DOCUMENT_REJECTED"
        : "DATA_ROOM_DOCUMENT_UNDER_REVIEW";

  await audit(
    ventureId,
    actionKey,
    session,
    {
      document_id: documentId,
      category: document.category,
      version: reviewedVersion,
      status: decision,
      // The reason is deliberately recorded on the document, not in the log:
      // the log keeps events, never document contents.
    },
    database,
  );

  try {
    const label = decision === "verified" ? "verified" : decision === "rejected" ? "rejected" : "sent for review";
    // The notification audience is read by internal id; the route may carry the
    // code, so resolve it once for this one call.
    const audienceVentureId = await resolveVentureInternalId(ventureId, database);
    await notifyVentureFounders(
      audienceVentureId,
      "Data Room document reviewed",
      `A Data Room document has been ${label}.`,
      {},
      { templateKey: "dataRoom.documentReviewed", params: { status: decision } },
    );
  } catch (_) {
    /* notification is best-effort */
  }

  return { ok: true, status: decision, reviewed_version: reviewedVersion };
}

/** Edit the metadata a manager may correct without creating a version. */
export async function updateDataRoomMetadata({ ventureId, documentId, session, input, database }) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  await ensureDataRoomSchema(database);
  const existing = await selectDataRoomDocument(ventureId, documentId, {}, database);
  const document = existing.rows?.[0];
  if (!document) return refusal(404, "errors.notFound");

  const sets = [];
  const args = [];
  if (input?.title !== undefined) {
    const title = cleanText(input.title, MAX_TITLE);
    if (!title) return refusal(400, "dataRoom.errors.titleRequired");
    sets.push("title = ?", "name = ?");
    args.push(title, title);
  }
  if (input?.description !== undefined) {
    sets.push("description = ?");
    args.push(cleanText(input.description, MAX_DESCRIPTION) || null);
  }
  if (input?.category !== undefined) {
    if (!isDataRoomCategory(input.category)) return refusal(400, "dataRoom.errors.categoryInvalid");
    sets.push("category = ?");
    args.push(input.category);
  }
  if (input?.expires_at !== undefined) {
    try {
      sets.push("expires_at = ?");
      args.push(parseExpiry(input.expires_at));
    } catch (error) {
      return refusal(400, error.message);
    }
  }
  if (sets.length === 0) return { ok: true, updated: false };

  sets.push("updated_at = NOW()");
  args.push(documentId);
  await updateDataRoomDocument(sets, args, database);

  await audit(
    ventureId,
    "DATA_ROOM_DOCUMENT_UPDATED",
    session,
    { document_id: documentId, category: input.category || document.category },
    database,
  );

  return { ok: true, updated: true };
}

/**
 * Remove a document from the catalogue. The row is SOFT-deleted and its
 * versions are kept, so the audit trail survives; the stored file is not
 * reachable through the Data Room any more.
 */
export async function deleteDataRoomDocument({ ventureId, documentId, session, database }) {
  const viewer = await resolveDataRoomViewer({ ventureId, session, database });
  if (!viewer.allowed) return refusal(404, "errors.notFound");
  if (!viewer.canManage) return refusal(403, "errors.insufficientPermissions");

  await ensureDataRoomSchema(database);
  const existing = await selectDataRoomDocument(ventureId, documentId, {}, database);
  const document = existing.rows?.[0];
  if (!document) return refusal(404, "errors.notFound");

  await softDeleteDataRoomDocument(documentId, session.cid || "system", database);

  await audit(
    ventureId,
    "DATA_ROOM_DOCUMENT_DELETED",
    session,
    { document_id: documentId, category: document.category, version: document.current_version || 1 },
    database,
  );

  return { ok: true };
}
