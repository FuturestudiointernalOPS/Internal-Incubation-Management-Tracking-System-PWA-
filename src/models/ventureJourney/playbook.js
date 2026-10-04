import db from "@/lib/db";

/**
 * Venture Journey model — facilitator playbook (REPOSITORY layer).
 *
 * The playbook table guard and the seed/read statements behind
 * `/api/ventures/[id]/playbook`. Split verbatim out of
 * `models/ventureJourney.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getPlaybookVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Ensure the venture_facilitator_playbook table exists. */
export async function ensurePlaybookTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS venture_facilitator_playbook (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
      stage_order INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      objective TEXT,
      expected_outcome TEXT,
      questions TEXT,
      evidence TEXT,
      documents TEXT,
      mistakes TEXT,
      approval_criteria TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(venture_id, stage_order)
    )`,
  });
}

/** Existing playbook entry count for a venture (seed check). */
export async function countPlaybookEntries(ventureId) {
  return db.execute({
    sql: "SELECT COUNT(*) as c FROM venture_facilitator_playbook WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Seed one facilitator playbook stage for a venture. */
export async function insertPlaybookStage(ventureId, stage) {
  return db.execute({
    sql: "INSERT INTO venture_facilitator_playbook (venture_id, stage_order, stage_name, objective, expected_outcome, questions, evidence, documents, mistakes, approval_criteria) VALUES (?,?,?,?,?,?,?,?,?,?)",
    args: [ventureId, stage.stage_order, stage.stage_name, stage.objective, stage.expected_outcome, stage.questions, stage.evidence, stage.documents, stage.mistakes, stage.approval_criteria],
  });
}

/** All facilitator playbook entries for a venture, ordered by stage_order. */
export async function getPlaybookEntries(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_facilitator_playbook WHERE venture_id = ? ORDER BY stage_order ASC",
    args: [ventureId],
  });
}
