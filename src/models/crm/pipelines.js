import db from "@/lib/db";

/**
 * CRM Pipelines model — data access for crm_pipelines and crm_pipeline_stages.
 *
 * Part of CRM Phase 3 (see migrations/phase4_crm_opportunities_pipelines.sql).
 * Pure data layer — no HTTP imports.
 *
 * ARCHITECTURAL NOTE: This is the generic CRM pipeline. It is completely
 * independent of investment_pipeline (investor-scoped fundraising).
 * Never import from or write to investment_pipeline here.
 */

// ─── PIPELINES ───────────────────────────────────────────────────────────────

/** All active CRM pipelines, ordered by name. */
export async function getCrmPipelines({ includeInactive = false } = {}) {
  return db.execute(
    includeInactive
      ? "SELECT * FROM crm_pipelines ORDER BY name ASC"
      : "SELECT * FROM crm_pipelines WHERE is_active = true ORDER BY name ASC",
  );
}

/** Single pipeline by id. */
export async function getCrmPipelineById(id) {
  return db.execute({
    sql: "SELECT * FROM crm_pipelines WHERE id = ?",
    args: [id],
  });
}

/** Pipeline with its ordered stages in one call. */
export async function getCrmPipelineWithStages(id) {
  const [pipeline, stages] = await Promise.all([
    getCrmPipelineById(id),
    getCrmPipelineStages(id),
  ]);
  return {
    pipeline: pipeline.rows?.[0] ?? null,
    stages:   stages.rows ?? [],
  };
}

export async function createCrmPipeline({ name, description, type, created_by }) {
  return db.execute({
    sql: `INSERT INTO crm_pipelines (name, description, type, created_by)
          VALUES (?, ?, ?, ?)
          RETURNING *`,
    args: [name, description ?? null, type ?? null, created_by ?? null],
  });
}

export async function updateCrmPipeline(id, { name, description, type, is_active }) {
  return db.execute({
    sql: `UPDATE crm_pipelines
          SET name        = COALESCE(?, name),
              description = COALESCE(?, description),
              type        = COALESCE(?, type),
              is_active   = COALESCE(?, is_active),
              updated_at  = NOW()
          WHERE id = ?
          RETURNING *`,
    args: [name ?? null, description ?? null, type ?? null, is_active ?? null, id],
  });
}

// ─── PIPELINE STAGES ─────────────────────────────────────────────────────────

/** All stages for a pipeline ordered by position. */
export async function getCrmPipelineStages(pipelineId, { includeInactive = false } = {}) {
  return db.execute({
    sql: includeInactive
      ? `SELECT * FROM crm_pipeline_stages WHERE pipeline_id = ? ORDER BY position ASC`
      : `SELECT * FROM crm_pipeline_stages WHERE pipeline_id = ? AND is_active = true ORDER BY position ASC`,
    args: [pipelineId],
  });
}

/** Single stage by id. */
export async function getCrmStageById(id) {
  return db.execute({
    sql: "SELECT * FROM crm_pipeline_stages WHERE id = ?",
    args: [id],
  });
}

/** First active stage in a pipeline — used as default for new opportunities. */
export async function getFirstCrmPipelineStage(pipelineId) {
  return db.execute({
    sql: `SELECT * FROM crm_pipeline_stages
          WHERE pipeline_id = ? AND is_active = true AND is_terminal = false
          ORDER BY position ASC LIMIT 1`,
    args: [pipelineId],
  });
}

export async function createCrmPipelineStage({
  pipeline_id, name, description, position, probability,
  is_terminal, outcome,
}) {
  return db.execute({
    sql: `INSERT INTO crm_pipeline_stages
            (pipeline_id, name, description, position, probability, is_terminal, outcome)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      pipeline_id,
      name,
      description ?? null,
      position,
      probability ?? 0,
      is_terminal ?? false,
      outcome ?? null,
    ],
  });
}

export async function updateCrmPipelineStage(id, { name, description, position, probability, is_active }) {
  return db.execute({
    sql: `UPDATE crm_pipeline_stages
          SET name        = COALESCE(?, name),
              description = COALESCE(?, description),
              position    = COALESCE(?, position),
              probability = COALESCE(?, probability),
              is_active   = COALESCE(?, is_active),
              updated_at  = NOW()
          WHERE id = ?
          RETURNING *`,
    args: [
      name ?? null,
      description ?? null,
      position ?? null,
      probability ?? null,
      is_active ?? null,
      id,
    ],
  });
}
