/**
 * verification — The verification workflow: read, submit, review status, resubmit, documents.
 *
 * Part of `services/ventures/verification` (split out of the former single
 * 487-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/verification.js`.
 */
import { listActiveVentureDocumentTypesOrDefaults } from "@/models/ventureDocumentTypes";
import {
  deleteVerificationDocumentRow,
  insertVerification,
  insertVerificationDocument,
  insertVerificationDocumentVersionOne,
  insertVerificationItem,
  insertVerificationItemUpdatedHistory,
  insertVerificationResubmittedHistory,
  insertVerificationStatusHistory,
  insertVerificationSubmittedHistory,
  reopenVerificationRow,
  resetVerificationItemToPending,
  selectVerification,
  selectVerificationByIdAndVenture,
  selectVerificationComments,
  selectVerificationDocuments,
  selectVerificationHistory,
  selectVerificationItemByCategory,
  selectVerificationItems,
  selectVerificationReviews,
  setVerificationItemUnderReview,
  submitVerificationRow,
  updateVerificationItemStatus,
  updateVerificationRow,
  verifyAllPendingItems,
} from "@/models/ventureVerificationStore";
import { logVentureActivity } from "@/services/ventures/activity";
import { VERIFICATION_CATEGORY_LABELS, resolveActiveDocumentTypeCodes } from "./categories";
import { ensureVerificationVersionTable } from "./versions";

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
