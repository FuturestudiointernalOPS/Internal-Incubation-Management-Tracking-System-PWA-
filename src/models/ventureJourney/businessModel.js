import db from "@/lib/db";

/**
 * Venture Journey model — business model (REPOSITORY layer).
 *
 * The business-model reads, upsert lookup and dynamic insert/update behind
 * `/api/ventures/[id]/business-model`. Split verbatim out of
 * `models/ventureJourney.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getBusinessModelVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** The venture's business model row (single-row lookup). */
export async function getVentureBusinessModel(ventureId) {
  return db.execute({
    sql: `SELECT * FROM venture_business_models WHERE venture_id = ?`,
    args: [ventureId],
  });
}

/** Existing business model row id for a venture (upsert lookup). */
export async function findVentureBusinessModel(ventureId) {
  return db.execute({
    sql: "SELECT id FROM venture_business_models WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Dynamic field update — setClauses/upArgs are built by the controller. */
export async function updateVentureBusinessModel(setClauses, upArgs) {
  return db.execute({
    sql: `UPDATE venture_business_models SET ${setClauses.join(", ")} WHERE venture_id = ?`,
    args: upArgs,
  });
}

/** Dynamic field insert — insertCols/insertVals/insertArgs are built by the controller. */
export async function createVentureBusinessModel(insertCols, insertVals, insertArgs) {
  return db.execute({
    sql: `INSERT INTO venture_business_models (${insertCols.join(", ")}) VALUES (${insertVals.join(", ")})`,
    args: insertArgs,
  });
}
