import db from "@/lib/db";

/**
 * Platform AI model — form generation, analysis log and framework config
 * (REPOSITORY layer).
 *
 * Split verbatim out of `models/platformAi.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ── /api/platform/ai/generate-all — AI-generated form + framework ────────────

/** Create the AI-generated form draft; returns the full form row. */
export async function createAiGeneratedForm(title, description, collectionId) {
  return db.execute({
    sql: `INSERT INTO platform_forms (name, description, collection_id, status, visibility, version, tags, owner_id, owner_name, settings, created_by)
            VALUES (?, ?, ?, 'draft', 'internal', 1, ARRAY['ai-generated'], 'system', 'AI', '{}', 'system') RETURNING *`,
    args: [title, description || null, collectionId ? parseInt(collectionId) : null],
  });
}

/** Insert one AI-generated section; returns its id. */
export async function insertAiGeneratedSection(formId, title, description, sortOrder) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, ?, ?, ?) RETURNING id",
    args: [formId, title, description || null, sortOrder],
  });
}

/** Insert one AI-generated field inside a section. */
export async function insertAiGeneratedField(formId, sectionId, field, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, placeholder, help_text, required, options, validation, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      formId,
      sectionId,
      field.field_type,
      field.label,
      field.placeholder || null,
      field.help_text || null,
      field.required,
      field.options ? JSON.stringify(field.options) : null,
      field.validation ? JSON.stringify(field.validation) : null,
      sortOrder,
    ],
  });
}

/** Save (or replace) the AI-generated evaluation framework for the form. */
export async function upsertAiEvaluationFramework(formId, framework, sourceDocument) {
  return db.execute({
    sql: `INSERT INTO platform_evaluation_frameworks (form_id, framework, source_document, created_by, updated_at)
              VALUES (?, ?, ?, 'ai', NOW())
              ON CONFLICT (form_id) DO UPDATE SET framework = EXCLUDED.framework, updated_at = NOW()`,
    args: [formId, JSON.stringify(framework), sourceDocument.substring(0, 500)],
  });
}

/** Delete a form by id (orphan cleanup after a failed AI generation). */
export async function deleteFormById(formId) {
  return db.execute({
    sql: "DELETE FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

// ── /api/platform/ai/analyze — submission summarize/analyze ──────────────────

/** Full submission row for AI analysis. */
export async function getSubmissionForAiAnalysis(submissionId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
    args: [submissionId],
  });
}

/** Full run row providing context for AI analysis. */
export async function getRunForAiAnalysis(runId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
}

/** Full form row providing context for AI analysis. */
export async function getFormForAiAnalysis(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Governance log entry recording that a submission was AI-analyzed. */
export async function logAiAnalysisToTimeline(submissionId, metadata) {
  return db.execute({
    sql: `INSERT INTO platform_submission_timeline (submission_id, action, actor_id, metadata)
              VALUES (?, 'ai_analyzed', ?, ?)`,
    args: [submissionId, "system", JSON.stringify(metadata)],
  });
}

// ── /api/platform/ai/evaluation-config — framework CRUD ──────────────────────

/** The saved evaluation framework for a form (if any). */
export async function getEvaluationFrameworkByFormId(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_evaluation_frameworks WHERE form_id = ?",
    args: [parseInt(formId)],
  });
}

/** Save or update an evaluation framework for a form. */
export async function upsertFormEvaluationFramework(formId, framework, sourceDocument) {
  return db.execute({
    sql: `INSERT INTO platform_evaluation_frameworks (form_id, framework, source_document, created_by, updated_at)
            VALUES (?, ?, ?, 'system', NOW())
            ON CONFLICT (form_id) DO UPDATE SET
              framework = EXCLUDED.framework,
              source_document = EXCLUDED.source_document,
              updated_at = NOW()`,
    args: [parseInt(formId), JSON.stringify(framework), sourceDocument || null],
  });
}

/** Remove the evaluation framework for a form (disables AI evaluation). */
export async function deleteEvaluationFrameworkByFormId(formId) {
  return db.execute({
    sql: "DELETE FROM platform_evaluation_frameworks WHERE form_id = ?",
    args: [parseInt(formId)],
  });
}
