/**
 * Venture startup-profile wizard — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/profile`: the startup-profile
 * row and its per-step JSON columns, the progress row, the profile documents,
 * and the two role probes used by the edit/read access checks.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";

// ── Profile + progress ───────────────────────────────────────────────────────
//
// `startup_profiles` / `startup_profile_progress` key on the INTERNAL id since
// Phase 0; every function below resolves its reference, so the service keeps
// passing whatever identifier it holds.

/** One startup_profiles row for a Venture, or empty rows if none exists yet. */
export async function selectStartupProfile(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "SELECT * FROM startup_profiles WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Create the empty startup_profiles row for a Venture. */
export async function insertStartupProfile(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "INSERT INTO startup_profiles (venture_id) VALUES (?)",
    args: [ventureId],
  });
}

/** One startup_profile_progress row for a Venture, or empty rows if none. */
export async function selectProfileProgress(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "SELECT * FROM startup_profile_progress WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Create the initial progress row (step 1, 0%). */
export async function insertProfileProgress(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "INSERT INTO startup_profile_progress (venture_id, current_step, completion_percentage) VALUES (?, 1, 0)",
    args: [ventureId],
  });
}

/** Persist one wizard step's JSON payload (column name chosen by the service). */
export async function updateProfileStepColumn(ventureRef, stepColumn, serialized) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `UPDATE startup_profiles SET ${stepColumn} = ?::jsonb, updated_at = NOW() WHERE venture_id = ?`,
    args: [serialized, ventureId],
  });
}

/** Move the progress row to the worked-on step and its recomputed completion. */
export async function updateProfileProgress(ventureRef, step, completionPercentage, lastCompletedStep) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `UPDATE startup_profile_progress
          SET current_step = ?, completion_percentage = ?, last_completed_step = ?, last_updated = NOW()
          WHERE venture_id = ?`,
    args: [step, completionPercentage, lastCompletedStep, ventureId],
  });
}

/** Flag the profile as submitted at the given timestamp. */
export async function markProfileSubmitted(ventureRef, now) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "UPDATE startup_profiles SET is_submitted = TRUE, submitted_at = ? WHERE venture_id = ?",
    args: [now, ventureId],
  });
}

/** Mark the progress row fully complete (step `step`, 100%). */
export async function completeProfileProgress(ventureRef, step) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `UPDATE startup_profile_progress
          SET current_step = ?, completion_percentage = 100, last_completed_step = ?, is_completed = TRUE, last_updated = NOW()
          WHERE venture_id = ?`,
    args: [step, step, ventureId],
  });
}

// ── Documents ────────────────────────────────────────────────────────────────

/** A Venture's profile documents, newest first. */
export async function selectProfileDocuments(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "SELECT * FROM startup_profile_documents WHERE venture_id = ? ORDER BY uploaded_at DESC",
    args: [ventureId],
  });
}

/** Upsert one profile document (unique on venture/type/name). */
export async function upsertProfileDocument({
  ventureId: ventureRef, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy,
}) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `INSERT INTO startup_profile_documents (venture_id, document_type, file_name, file_size, file_type, file_url, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (venture_id, document_type, file_name)
          DO UPDATE SET file_url = ?, file_size = ?, file_type = ?, uploaded_at = NOW()`,
    args: [ventureId, documentType, fileName, fileSize, fileType, fileUrl, uploadedBy, fileUrl, fileSize, fileType],
  });
}

/** Delete one profile document by id within its Venture. */
export async function deleteProfileDocumentRow(ventureRef, documentId) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "DELETE FROM startup_profile_documents WHERE id = ? AND venture_id = ?",
    args: [documentId, ventureId],
  });
}

// ── Access probes ────────────────────────────────────────────────────────────

/** Whether an email is a registered founder of the Venture. */
export async function selectFounderIdByEmail(ventureRef, email) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "SELECT id FROM venture_founders WHERE venture_id = ? AND LOWER(email) = LOWER(?)",
    args: [ventureId, email],
  });
}

/** Whether a contact is a founder-like member of the Venture. */
export async function selectFounderMemberIdByCid(ventureRef, cid) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND user_cid = ? AND role IN ('founder', 'co-founder')",
    args: [ventureId, cid],
  });
}

/** The VNT code of a Venture from its internal id given as text. */
export function selectVentureCodeByIdText(ventureId) {
  return db.execute({ sql: "SELECT venture_id FROM ventures WHERE id::text = ?", args: [ventureId] });
}
