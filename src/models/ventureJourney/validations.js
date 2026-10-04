import db from "@/lib/db";

/**
 * Venture Journey model — validations and investment readiness (REPOSITORY layer).
 *
 * The validation CRUD behind `/api/ventures/[id]/validations` and the
 * readiness-document read behind `/api/ventures/[id]/investment-readiness`.
 * Split verbatim out of `models/ventureJourney.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getValidationsVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** All validations for a venture, newest first. */
export async function getVentureValidations(ventureId) {
  return db.execute({
    sql: `SELECT * FROM venture_validations WHERE venture_id = ? ORDER BY created_at DESC`,
    args: [ventureId],
  });
}

/** Create a validation entry for a venture. */
export async function createVentureValidation(ventureId, validationType, status, notes, createdBy) {
  return db.execute({
    sql: `INSERT INTO venture_validations (venture_id, validation_type, status, notes, created_by)
            VALUES (?, ?, ?, ?, ?)`,
    args: [ventureId, validationType, status, notes, createdBy],
  });
}

/** Dynamic field update — updates/args are built by the controller. */
export async function updateVentureValidationFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_validations SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getInvestmentReadinessVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Approved/shared venture documents for the investment-readiness checklist. */
export async function getVentureInvestmentDocuments(ventureId) {
  return db.execute({
    sql: "SELECT name, category, approval_status FROM venture_documents WHERE venture_id = ? AND is_deleted = false ORDER BY approval_status, name",
    args: [ventureId],
  });
}
