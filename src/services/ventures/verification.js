/**
 * VENTURE VERIFICATION (the Data bank).
 *
 * The compliance file of a Venture: the verification record and its items, the
 * founder submission / reviewer sign-off / resubmission flows, the document
 * uploads and their version history, and the comments.
 *
 * The decisions — who may manage the sign-off or submit, which document types
 * are asked for, the missing-document gate, the status transitions and the
 * version numbering — live here; every statement is in
 * `@/models/ventureVerificationStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) —
 * see docs/LAYER_SPLIT.md.
 */

import {
  selectVerification,
  insertVerification,
  selectVerificationByIdAndVenture,
  selectVerificationItems,
  selectVerificationItemByCategory,
  insertVerificationItem,
  selectVerificationDocuments,
  selectVerificationHistory,
  selectVerificationReviews,
  selectVerificationComments,
  selectVerificationFounderIdByEmail,
  submitVerificationRow,
  reopenVerificationRow,
  updateVerificationRow,
  setVerificationItemUnderReview,
  resetVerificationItemToPending,
  updateVerificationItemStatus,
  verifyAllPendingItems,
  insertVerificationSubmittedHistory,
  insertVerificationResubmittedHistory,
  insertVerificationItemUpdatedHistory,
  insertVerificationStatusHistory,
  insertVerificationDocument,
  deleteVerificationDocumentRow,
  createVerificationVersionsTable,
  selectVerificationDocumentForVenture,
  selectVerificationDocumentVersions,
  selectMaxVerificationDocumentVersion,
  insertVerificationDocumentVersionOne,
  insertVerificationDocumentVersion,
  updateVerificationDocumentLive,
  insertVerificationComment,
} from "@/models/ventureVerificationStore";
import {
  listActiveVentureDocumentTypesOrDefaults,
  canManageVentureDocumentTypes,
} from "@/models/ventureDocumentTypes";
import { DEFAULT_VENTURE_DOCUMENT_TYPES } from "@/lib/ventureDocumentTypeDefaults";
import { logVentureActivity } from "@/services/ventures/activity";

/**
 * The document types the Data bank asks for now live in `venture_document_types`
 * (see the model) and are defined by a Super Admin or a Lead Manager. These two
 * exports are the built-in seed, kept as the load-bearing fallback for a
 * database whose configuration table cannot be read.
 */
export const VERIFICATION_CATEGORIES = DEFAULT_VENTURE_DOCUMENT_TYPES.map(
  (documentType) => documentType.code,
);

export const VERIFICATION_CATEGORY_LABELS = Object.fromEntries(
  DEFAULT_VENTURE_DOCUMENT_TYPES.map((documentType) => [documentType.code, documentType.label_en]),
);

/**
 * The codes a document may be filed under right now FOR ONE VENTURE: the
 * types its Data bank asks for, falling back to the built-in set. Used to refuse
 * a document filed under an unknown (or retired) type.
 */
async function resolveActiveDocumentTypeCodes(ventureId) {
  const types = await listActiveVentureDocumentTypesOrDefaults(ventureId);
  return (types || []).map((documentType) => documentType.code);
}

/**
 * Check if user can manage verification (review/submit for others).
 */
export async function canManageVerification(ventureId, session) {
  if (!session) return { allowed: false };
  if (session.role === "super_admin") return { allowed: true, isReviewer: true };
  if (session.role === "verification_officer") return { allowed: true, isReviewer: true };
  // The Data bank sign-off belongs to whoever leads the WHOLE Venture — the
  // Super Admin, or its Lead Manager. This is the same rule that lets them
  // define the Venture's Data bank documents, so the two doors agree. A scoped
  // coach reviews the milestones they were given, not the Venture's compliance
  // file, so a milestone/task-scoped assignment is deliberately not enough.
  if (session.role === "staff") {
    // Assignments key on the VNT code; the rule above is asked of the code, so
    // an internal id in the URL is resolved first.
    const { resolveVentureCode } = await import("@/lib/ventureScope");
    const code = await resolveVentureCode(ventureId);
    if (code && (await canManageVentureDocumentTypes(session, code))) {
      return { allowed: true, isReviewer: true };
    }
  }
  return { allowed: false };
}

/**
 * Check if user can submit verification (founder).
 */
export async function canSubmitVerification(ventureId, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;

  const founderRes = await selectVerificationFounderIdByEmail(ventureId, session.email || "");
  return founderRes.rows.length > 0;
}

/**
 * Get or create a verification record for a venture.
 */
export async function getOrCreateVerification(ventureId) {
  let res = await selectVerification(ventureId);

  let verification;
  if (res.rows.length === 0) {
    await insertVerification(ventureId);
    res = await selectVerification(ventureId);
  }
  verification = res.rows[0];

  // Get verification items (create defaults if not exist)
  const itemsRes = await selectVerificationItems(verification.id);

  // Reconcile the Venture's items with the document types its Data bank asks
  // for: a type added after this Venture was first opened gets its item here, so
  // every Venture shows exactly the types defined for IT. A type that was turned
  // off keeps its item and its uploaded documents — it is simply not asked for
  // any more (the screens render the configured list).
  const documentTypes = await listActiveVentureDocumentTypesOrDefaults(ventureId);
  const knownCategories = new Set(itemsRes.rows.map((item) => item.category));
  const addedCategories = documentTypes
    .map((documentType) => documentType.code)
    .filter((code) => !knownCategories.has(code));

  if (addedCategories.length > 0) {
    for (const category of addedCategories) {
      await insertVerificationItem(verification.id, category);
    }
  }

  const itemsRes2 =
    addedCategories.length > 0
      ? await selectVerificationItems(verification.id)
      : itemsRes;
  const items = itemsRes2.rows;

  // Get documents
  const docsRes = await selectVerificationDocuments(verification.id);

  // Get history
  const historyRes = await selectVerificationHistory(verification.id);

  // Get reviews
  const reviewsRes = await selectVerificationReviews(verification.id);

  // Get comments
  const commentsRes = await selectVerificationComments(verification.id);

  return {
    verification,
    items: items.map((item) => ({
      ...item,
      category_label:
        documentTypes.find((documentType) => documentType.code === item.category)?.label_en ||
        VERIFICATION_CATEGORY_LABELS[item.category] ||
        item.category,
    })),
    documents: docsRes.rows,
    history: historyRes.rows,
    reviews: reviewsRes.rows,
    comments: commentsRes.rows,
  };
}

/**
 * Submit verification for review.
 */
export async function submitVerification({ ventureId, submittedBy }) {
  const data = await getOrCreateVerification(ventureId);
  const { verification, items, documents } = data;

  if (verification.status === "verified") {
    throw new Error("Venture is already verified.");
  }
  if (verification.status === "pending_review") {
    throw new Error("Verification is already under review.");
  }

  // Check every REQUIRED, upload-backed document type has at least one file. A
  // type confirmed by another means (email, phone) and an optional one never
  // block the submission.
  const documentTypes = await listActiveVentureDocumentTypesOrDefaults(ventureId);
  const typesByCode = new Map((documentTypes || []).map((documentType) => [documentType.code, documentType]));
  const missingCategories = [];
  for (const item of items) {
    const documentType = typesByCode.get(item.category);
    if (!documentType) continue; // retired type — no longer asked for
    if (documentType.verification_method === "external") continue;
    if (documentType.required === false) continue;
    if (item.status === "not_applicable") continue;
    const hasDoc = documents.some((document) => document.category === item.category);
    if (!hasDoc) {
      missingCategories.push(documentType.label_en || VERIFICATION_CATEGORY_LABELS[item.category] || item.category);
    }
  }

  if (missingCategories.length > 0) {
    throw new Error(`Missing documents for: ${missingCategories.join(", ")}`);
  }

  if (verification.status === "pending_review") {
    throw new Error("A verification request is already pending review.");
  }

  const now = new Date().toISOString();

  await submitVerificationRow(verification.id, now);

  for (const item of items) {
    if (item.status === "pending" || item.status === "rejected") {
      await setVerificationItemUnderReview(item.id, now);
    }
  }

  await insertVerificationSubmittedHistory(
    verification.id,
    verification.status,
    submittedBy?.cid || "system",
    submittedBy?.name || "System",
    now,
  );

  try {
    await logVentureActivity({
      venture_id: ventureId,
      action: "VERIFICATION_SUBMITTED",
      actor_cid: submittedBy?.cid || "system",
      actor_name: submittedBy?.name || "System",
      details: { verification_id: verification.id, categories: items.length },
    });
  } catch (_) {}

  return { success: true, status: "pending_review", submitted_at: now };
}

/**
 * Update verification status (approve/reject/suspend).
 */
export async function updateVerificationStatus({
  verificationId, ventureId, newStatus, category, reviewerCid, reviewerName, notes,
}) {
  if (!["verified", "rejected", "suspended"].includes(newStatus)) {
    throw new Error(`Invalid status: "${newStatus}". Must be verified, rejected, or suspended.`);
  }

  const verRes = await selectVerificationByIdAndVenture(verificationId, ventureId);
  if (verRes.rows.length === 0) throw new Error("Verification not found.");
  const verification = verRes.rows[0];

  const now = new Date().toISOString();
  const previousStatus = verification.status;

  if (category) {
    if (!(await resolveActiveDocumentTypeCodes(ventureId)).includes(category)) {
      throw new Error(`Invalid category: "${category}".`);
    }

    const itemRes = await selectVerificationItemByCategory(verificationId, category);
    if (itemRes.rows.length === 0) throw new Error("Verification item not found.");
    const item = itemRes.rows[0];

    await updateVerificationItemStatus(item.id, newStatus, notes || null, reviewerCid, now);

    await insertVerificationItemUpdatedHistory({
      verificationId,
      previousStatus: item.status,
      newStatus,
      reviewerCid: reviewerCid || "system",
      reviewerName: reviewerName || "System",
      notes: notes || null,
      metadataJson: JSON.stringify({ category, item_id: item.id }),
      now,
    });
  } else {
    await updateVerificationRow(verificationId, newStatus, reviewerCid, now, notes || null);

    if (newStatus === "verified") {
      await verifyAllPendingItems(verificationId, now);
    }

    const actionKey = newStatus === "verified" ? "VERIFICATION_APPROVED" : newStatus === "rejected" ? "VERIFICATION_REJECTED" : "VERIFICATION_SUSPENDED";

    await insertVerificationStatusHistory({
      verificationId,
      actionKey,
      previousStatus,
      newStatus,
      reviewerCid: reviewerCid || "system",
      reviewerName: reviewerName || "System",
      notes: notes || null,
      now,
    });

    try {
      await logVentureActivity({
        venture_id: ventureId, action: actionKey, actor_cid: reviewerCid || "system",
        actor_name: reviewerName || "System", details: { verification_id: verificationId, previous_status: previousStatus, notes },
      });
    } catch (_) {}
  }

  return { success: true, status: newStatus };
}

/**
 * Resubmit verification after rejection.
 */
export async function resubmitVerification({ ventureId, submittedBy }) {
  const data = await getOrCreateVerification(ventureId);
  const { verification, items } = data;

  if (verification.status !== "rejected") throw new Error("Only rejected verifications can be resubmitted.");

  const now = new Date().toISOString();

  for (const item of items) {
    if (item.status === "rejected") {
      await resetVerificationItemToPending(item.id, now);
    }
  }

  await reopenVerificationRow(verification.id, now);

  await insertVerificationResubmittedHistory(
    verification.id,
    submittedBy?.cid || "system",
    submittedBy?.name || "System",
    now,
  );

  try {
    await logVentureActivity({
      venture_id: ventureId, action: "VERIFICATION_RESUBMITTED", actor_cid: submittedBy?.cid || "system",
      actor_name: submittedBy?.name || "System", details: { verification_id: verification.id, resubmitted: true },
    });
  } catch (_) {}

  return { success: true, status: "pending_review", submitted_at: now };
}

/**
 * Upload a verification document.
 */
export async function uploadVerificationDocument({ ventureId, verificationId, category, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy }) {
  if (!(await resolveActiveDocumentTypeCodes(ventureId)).includes(category)) {
    throw new Error(`Invalid category: "${category}".`);
  }

  const inserted = await insertVerificationDocument({
    verificationId, category, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy,
  });

  // The first upload IS version 1 of the document, so the history always starts
  // at the first file the Venture filed rather than at the first re-upload.
  const documentId = inserted.rows?.[0]?.id;
  if (documentId != null) {
    await ensureVerificationVersionTable();
    await insertVerificationDocumentVersionOne(documentId, fileName, fileSize, fileType, fileUrl, uploadedBy).catch(() => {});
  }
  return { success: true };
}

/**
 * Delete a verification document.
 */
export async function deleteVerificationDocument({ documentId }) {
  await deleteVerificationDocumentRow(documentId);
  return { success: true };
}

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
async function ensureVerificationVersionTable() {
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
