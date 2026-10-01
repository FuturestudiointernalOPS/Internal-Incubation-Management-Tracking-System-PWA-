/**
 * verification — Data bank document versions and comments.
 *
 * Part of `services/ventures/verification` (split out of the former single
 * 487-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/verification.js`.
 */
import {
  createVerificationVersionsTable,
  insertVerificationComment,
  insertVerificationDocumentVersion,
  insertVerificationDocumentVersionOne,
  selectMaxVerificationDocumentVersion,
  selectVerificationDocumentForVenture,
  selectVerificationDocumentVersions,
  updateVerificationDocumentLive,
} from "@/models/ventureVerificationStore";

// ─── Data bank document versions ────────────────────────────────────────────
//
// A Data bank document row is the LIVE pointer: it always holds the newest file.
// Every upload — the first one included — is also recorded in
// `venture_verification_document_versions`, so the history runs from version 1
// (the first file the Venture filed) to the newest. Deleting the document
// cascades to its versions.

/**
 * Create the versions table if it is missing. The canonical definition ships in
 * `ensureVentureSchema` (which runs on Venture intake); this keeps read/write
 * working on an environment whose schema predates that migration. Best-effort.
 */
export async function ensureVerificationVersionTable() {
  try {
    await createVerificationVersionsTable();
  } catch (_) {}
}

/** The verification document of ONE Venture, or null when it is not there. */
async function findVerificationDocumentForVenture(ventureId, documentId) {
  const result = await selectVerificationDocumentForVenture(ventureId, documentId);
  return result.rows?.[0] || null;
}

/**
 * Every version of ONE Data bank document, oldest first (version 1 … newest).
 * Returns null when the document is not part of this Venture. A document filed
 * before versioning existed has no rows yet — its live file is reported as
 * version 1 so the history is never empty.
 */
export async function listVerificationDocumentVersions({ ventureId, documentId }) {
  const document = await findVerificationDocumentForVenture(ventureId, documentId);
  if (!document) return null;

  await ensureVerificationVersionTable();
  const result = await selectVerificationDocumentVersions(documentId);
  const versions = result.rows || [];
  if (versions.length > 0) return { document, versions };

  return {
    document,
    versions: [
      {
        id: `current-${document.id}`,
        document_id: document.id,
        version_number: 1,
        file_name: document.file_name,
        file_size: document.file_size,
        file_type: document.file_type,
        file_url: document.file_url,
        version_notes: null,
        uploaded_by: document.uploaded_by,
        uploaded_at: document.uploaded_at,
      },
    ],
  };
}

/**
 * File a NEW version of ONE Data bank document: record the upload as the next
 * version and point the document at it. Returns null when the document is not
 * part of this Venture. A pre-versioning document has its live file recorded as
 * version 1 first, so nothing is lost from the history.
 */
export async function addVerificationDocumentVersion({
  ventureId, documentId, fileUrl, fileName, fileSize, fileType, versionNotes, uploadedBy,
}) {
  const document = await findVerificationDocumentForVenture(ventureId, documentId);
  if (!document) return null;

  await ensureVerificationVersionTable();
  const maxResult = await selectMaxVerificationDocumentVersion(documentId);
  let nextVersion = parseInt(maxResult.rows?.[0]?.max_version || 0, 10) + 1;

  if (nextVersion === 1) {
    await insertVerificationDocumentVersionOne(
      documentId, document.file_name, document.file_size, document.file_type, document.file_url, document.uploaded_by,
    ).catch(() => {});
    nextVersion = 2;
  }

  await insertVerificationDocumentVersion({
    documentId, versionNumber: nextVersion, fileName, fileSize, fileType, fileUrl, versionNotes: versionNotes || null, uploadedBy,
  });

  await updateVerificationDocumentLive(documentId, fileName, fileSize, fileType, fileUrl, uploadedBy);

  return { success: true, version_number: nextVersion };
}

/**
 * Add a comment to a verification.
 */
export async function addVerificationComment({ verificationId, authorType, authorCid, authorName, message }) {
  await insertVerificationComment({ verificationId, authorType, authorCid, authorName, message });
  return { success: true };
}
