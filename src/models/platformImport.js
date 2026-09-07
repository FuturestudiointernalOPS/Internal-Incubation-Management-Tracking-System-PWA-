import db from "@/lib/db";

/**
 * Platform import model — data access for the platform CSV/XLSX import
 * controllers:
 *  - `src/app/api/platform/import/execute/route.js`
 *  - `src/app/api/platform/import/preview/route.js`
 *  - `src/app/api/platform/import/review-flags/route.js`
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * Where the original handlers ran the same query at multiple call sites (the
 * run lookup in execute + preview), the model keeps one function per call site
 * (1:1 extraction — see docs/MVC_REFACTOR.md §4).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/**
 * Resolve the run an import targets (returns id, name, form_id).
 * Used by POST /api/platform/import/execute — the run determines the form,
 * so a mismatched client form_id can never target the wrong form.
 */
export async function getFormRunByIdForImport(runId) {
  return db.execute({
    sql: "SELECT id, name, form_id FROM platform_form_runs WHERE id = ?",
    args: [parseInt(runId)],
  });
}

/** Form field labels — used to resolve the applicant email label-aware. */
export async function getFormFieldLabels(formId) {
  return db.execute({
    sql: "SELECT id, label FROM platform_form_fields WHERE form_id = ?",
    args: [formId],
  });
}

/** Self-heal: ensure the import batch table exists (additive, idempotent). */
export async function ensureImportBatchesTable() {
  return db.execute(`CREATE TABLE IF NOT EXISTS platform_import_batches (
        id SERIAL PRIMARY KEY,
        form_id INTEGER NOT NULL,
        run_id INTEGER NOT NULL,
        file_hash TEXT NOT NULL,
        total_rows INTEGER DEFAULT 0,
        imported INTEGER DEFAULT 0,
        skipped INTEGER DEFAULT 0,
        needs_review INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
}

/** Self-heal: ensure the review flags table exists (additive, idempotent). */
export async function ensureImportReviewFlagsTable() {
  return db.execute(`CREATE TABLE IF NOT EXISTS platform_import_review_flags (
        id SERIAL PRIMARY KEY,
        batch_id INTEGER,
        form_id INTEGER NOT NULL,
        run_id INTEGER NOT NULL,
        row_number INTEGER,
        applicant_name TEXT,
        applicant_email TEXT,
        matched_cid TEXT,
        matched_name TEXT,
        method TEXT,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )`);
}

/**
 * Most recent import batch for the same run + file hash — used to detect a
 * duplicate import of the same file (idempotency check).
 */
export async function findPreviousImportBatch(runId, fileHash) {
  return db.execute({
    sql: "SELECT id, created_at, imported, needs_review FROM platform_import_batches WHERE run_id = ? AND file_hash = ? ORDER BY id DESC LIMIT 1",
    args: [parseInt(runId), fileHash],
  });
}

/** Create the batch row upfront so review flags can reference it. Returns the new id. */
export async function createImportBatch(formId, runId, fileHash) {
  return db.execute({
    sql: `INSERT INTO platform_import_batches (form_id, run_id, file_hash, total_rows, imported, skipped, needs_review, created_by)
                VALUES (?, ?, ?, 0, 0, 0, 0, ?) RETURNING id`,
    args: [formId, parseInt(runId), fileHash, "system"],
  });
}

/** Insert (or, on email conflict, update) the contact for one imported row. */
export async function upsertImportedContact(cid, name, email, phone) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, role, status, password, deleted)
                  VALUES (?, ?, ?, ?, 'participant', 'pending', '', 0)
                  ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = COALESCE(EXCLUDED.phone, contacts.phone)
                  RETURNING *`,
    args: [cid, name, email, phone || null],
  });
}

/** Duplicate protection: does this submitter already have a submission in the run? */
export async function findSubmissionByRunAndSubmitter(runId, submitterCid) {
  return db.execute({
    sql: "SELECT id FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ? LIMIT 1",
    args: [parseInt(runId), submitterCid],
  });
}

/** Insert one imported submission (always status 'submitted'). */
export async function createPlatformFormSubmission(
  runId,
  submitterCid,
  submitterName,
  submissionData,
) {
  return db.execute({
    sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, data, status, submitted_at)
                VALUES (?, ?, ?, ?, 'submitted', NOW())`,
    args: [parseInt(runId), submitterCid, submitterName, JSON.stringify(submissionData)],
  });
}

/** Persist a review flag for the review screen (non-blocking). */
export async function createImportReviewFlag(
  batchId,
  formId,
  runId,
  rowNumber,
  applicantName,
  applicantEmail,
  matchedCid,
  matchedName,
  method,
  reason,
) {
  return db.execute({
    sql: `INSERT INTO platform_import_review_flags (batch_id, form_id, run_id, row_number, applicant_name, applicant_email, matched_cid, matched_name, method, reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      batchId,
      formId,
      parseInt(runId),
      rowNumber,
      applicantName,
      applicantEmail || null,
      matchedCid,
      matchedName,
      method,
      reason,
    ],
  });
}

/** Accumulate row counts into the batch row. */
export async function accumulateImportBatchCounts(
  totalRows,
  imported,
  skipped,
  needsReview,
  batchId,
) {
  return db.execute({
    sql: `UPDATE platform_import_batches
              SET total_rows = total_rows + ?,
                  imported = imported + ?,
                  skipped = skipped + ?,
                  needs_review = needs_review + ?
              WHERE id = ?`,
    args: [totalRows, imported, skipped, needsReview, batchId],
  });
}

/**
 * Resolve the run an import preview targets (returns id, name, form_id).
 * Used by POST /api/platform/import/preview — the run is the single source of
 * truth for the form, so the client-passed form_id is ignored when a run is set.
 */
export async function getFormRunByIdForPreview(runId) {
  return db.execute({
    sql: "SELECT id, name, form_id FROM platform_form_runs WHERE id = ?",
    args: [parseInt(runId)],
  });
}

/** Fetch the form (id, name) a preview targets. */
export async function getPlatformFormById(formId) {
  return db.execute({
    sql: "SELECT id, name FROM platform_forms WHERE id = ?",
    args: [parseInt(formId)],
  });
}

/** Fetch a form's questions AND their configured answer options for preview matching. */
export async function getFormFieldsForPreview(formId) {
  return db.execute({
    sql: "SELECT id, label, field_type, options, required FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order, id",
    args: [formId],
  });
}

/**
 * List identity review flags from historical imports.
 * status "all" omits the status filter; run_id / form_id filters are optional.
 */
export async function listImportReviewFlags(status, runId, formId) {
  let sql = "SELECT * FROM platform_import_review_flags WHERE 1=1";
  const args = [];

  if (status !== "all") {
    sql += " AND status = ?";
    args.push(status);
  }
  if (runId) {
    sql += " AND run_id = ?";
    args.push(parseInt(runId));
  }
  if (formId) {
    sql += " AND form_id = ?";
    args.push(parseInt(formId));
  }
  sql += " ORDER BY id DESC LIMIT 500";

  return db.execute({ sql, args });
}

/** Resolve or reopen a flagged identity. Returns the updated flag row. */
export async function updateImportReviewFlagStatus(status, id) {
  return db.execute({
    sql: "UPDATE platform_import_review_flags SET status = ? WHERE id = ? RETURNING *",
    args: [status || "resolved", parseInt(id)],
  });
}
