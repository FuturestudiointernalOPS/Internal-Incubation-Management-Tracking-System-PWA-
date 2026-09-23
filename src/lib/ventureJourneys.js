/**
 * Venture Journeys — shared access helpers.
 *
 * The Journey is the Venture-facing operating path of a Venture. It is NOT a
 * hardcoded platform curriculum: authorized Venture staff (Lead Manager /
 * Facilitator / others holding `operating_plan` capabilities on the Venture)
 * define the stages that specific Venture actually needs. Stages may be
 * generated from a reusable operating-plan template (structure only).
 *
 * Permission model reuses the `operating_plan` area of the GLOBAL permission
 * matrix (see lib/venturePermissions.js + lib/ventureOperatingPlans.js):
 *  - authors need create/edit/manage on the Venture (venture-wide scope);
 *  - members read the published Venture-facing stages through the API route.
 *
 * Data isolation: journey stage rows are Venture-owned (venture_journey_stages
 * keys on ventures(id)); nothing here reads Program/LMS/CRM data.
 */

// Venture-facing statuses of a journey stage. Staff drive transitions
// (activate -> complete; reset reopens). Locked = scheduled, not yet reached.
export const JOURNEY_STATUSES = ["locked", "active", "completed"];

/**
 * Create the journey stage table when missing and add the configurable
 * stage fields. Idempotent — safe on every request path that needs it.
 */
export async function ensureJourneyTable(db) {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS venture_journey_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      objective TEXT,
      target_date DATE,
      stage_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      completed_at TIMESTAMPTZ,
      approved_by TEXT REFERENCES contacts(cid),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(venture_id, stage_order)
    )`,
  });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS objective TEXT" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS target_date DATE" });
  // Archive (soft delete): archived journeys stay in the database (history
  // preserved) but are hidden from the Venture and from default lists.
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS archived_by TEXT" });
  // Template provenance: which reusable template generated this stage (if any).
  // plan = operating-plan template; journey = saved Journey template.
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS source_template_type TEXT" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS source_template_id TEXT" });
}

/**
 * Resolve the internal ventures(id) UUID used by the journey table.
 * Accepts either the VNT- code or the internal UUID.
 */
export async function resolveVentureInternalId(db, ventureId) {
  if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
    try {
      const byIdResult = await db.execute({ sql: "SELECT id FROM ventures WHERE id::text = ?", args: [ventureId] });
      if (byIdResult.rows?.[0]) return byIdResult.rows[0].id;
      return ventureId;
    } catch (_) {
      return ventureId;
    }
  }
  const result = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return result.rows?.[0]?.id || null;
}

/** Ordered stages for a Venture — only Venture-facing columns.
 *
 * Archived (soft-deleted) journeys are hidden by default; management
 * surfaces pass { includeArchived: true }. Falls back progressively when the
 * additive archive / template-provenance columns have not been migrated yet.
 */
export async function listJourneyStages(db, dbId, { includeArchived = false } = {}) {
  const coreCols = `id, name, description, objective, target_date, stage_order,
                 status, completed_at, created_at`;
  const templateCols = ", source_template_type, source_template_id";
  const archiveCols = ", is_archived, archived_at";
  const run = (withArchive, withTemplate) => {
    const hideArchived = withArchive && !includeArchived;
    return db.execute({
      sql: `SELECT ${coreCols}${withTemplate ? templateCols : ""}${withArchive ? archiveCols : ""}
            FROM venture_journey_stages WHERE venture_id = ?${hideArchived ? " AND (is_archived = FALSE OR is_archived IS NULL)" : ""}
            ORDER BY stage_order ASC`,
      args: [dbId],
    });
  };
  try {
    const res = await run(true, true);
    return res.rows || [];
  } catch (_) {
    try {
      const res = await run(false, true); // archive columns not migrated yet
      return res.rows || [];
    } catch (_) {
      const res = await run(false, false); // pre-template databases too
      return res.rows || [];
    }
  }
}

export async function getJourneyStage(db, dbId, stageId) {
  const res = await db.execute({
    sql: "SELECT * FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
  return res.rows?.[0] || null;
}

export async function nextJourneyStageOrder(db, dbId) {
  const res = await db.execute({
    sql: "SELECT COALESCE(MAX(stage_order), 0) + 1 AS next_order FROM venture_journey_stages WHERE venture_id = ?",
    args: [dbId],
  });
  return Number(res.rows?.[0]?.next_order || 1);
}

/**
 * Swap a stage with its neighbour (direction: up | down) inside a
 * transaction so the UNIQUE(venture_id, stage_order) constraint is never
 * violated mid-swap.
 */
export async function moveJourneyStage(db, { dbId, stageId, direction }) {
  return db.transaction(async (query) => {
    const rows = await query(
      "SELECT id, stage_order FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
      [dbId],
    );
    const list = rows.rows || [];
    const currentIndex = list.findIndex((stage) => stage.id === stageId);
    if (currentIndex === -1) return { error: "Stage not found." };
    const targetIndex = direction === "up" ? currentIndex - 1 : direction === "down" ? currentIndex + 1 : -1;
    if (targetIndex < 0 || targetIndex >= list.length) return { error: "Already at the edge." };

    const currentStage = list[currentIndex];
    const targetStage = list[targetIndex];
    // Park one order at a negative sentinel (orders are positive 1..n), then
    // swap — unique constraint is satisfied after every statement.
    await query("UPDATE venture_journey_stages SET stage_order = -1 WHERE id = ?", [currentStage.id]);
    await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [currentStage.stage_order, targetStage.id]);
    await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [targetStage.stage_order, currentStage.id]);
    return { success: true };
  });
}

/** Delete a stage and re-serialize the remaining order (1..n) atomically. */
export async function deleteJourneyStage(db, { dbId, stageId }) {
  return db.transaction(async (query) => {
    await query("DELETE FROM venture_journey_stages WHERE id = ? AND venture_id = ?", [stageId, dbId]);
    const rows = await query(
      "SELECT id FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
      [dbId],
    );
    for (let i = 0; i < (rows.rows || []).length; i++) {
      await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [i + 1, rows.rows[i].id]);
    }
    return { success: true };
  });
}
