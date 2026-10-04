import db from "@/lib/db";

// ── PUT /api/platform/form-runs ──────────────────────────────────────────────

/** Update run metadata fields present on the payload (returns the updated row). */
export async function updateFormRunMetadataById({ id, name, description, status, opens_at, closes_at, settings }) {
  const fields = [];
  const args = [];
  const updatable = { name, description, status, opens_at, closes_at };
  for (const [columnName, columnValue] of Object.entries(updatable)) {
    if (columnValue !== undefined) { fields.push(`${columnName} = ?`); args.push(columnValue); }
  }
  if (settings !== undefined) { fields.push("settings = ?"); args.push(JSON.stringify(settings)); }
  fields.push("updated_at = NOW()");
  args.push(parseInt(id));

  return db.execute({
    sql: `UPDATE platform_form_runs SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

// ── DELETE /api/platform/form-runs ───────────────────────────────────────────

/** Delete a run's email-log rows (cascade cleanup before run delete). */
export async function deleteEmailLogsByRunId(runId) {
  return db.execute({ sql: "DELETE FROM platform_email_log WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)", args: [runId] });
}

/** Delete a run's review rows (cascade cleanup before run delete). */
export async function deleteReviewsByRunId(runId) {
  return db.execute({ sql: "DELETE FROM platform_submission_reviews WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)", args: [runId] });
}

/** Delete a run's evaluation rows (cascade cleanup before run delete). */
export async function deleteEvaluationsByRunId(runId) {
  return db.execute({ sql: "DELETE FROM platform_submission_evaluations WHERE submission_id IN (SELECT id FROM platform_form_submissions WHERE run_id = ?)", args: [runId] });
}

/** Delete the run row itself (runs with FK cascades). */
export async function deleteFormRunById(runId) {
  return db.execute({ sql: "DELETE FROM platform_form_runs WHERE id = ?", args: [runId] });
}

