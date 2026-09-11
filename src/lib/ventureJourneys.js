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
}

/**
 * Resolve the internal ventures(id) UUID used by the journey table.
 * Accepts either the VNT- code or the internal UUID.
 */
export async function resolveVentureInternalId(db, ventureId) {
  if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
    try {
      const byId = await db.execute({ sql: "SELECT id FROM ventures WHERE id::text = ?", args: [ventureId] });
      if (byId.rows?.[0]) return byId.rows[0].id;
      return ventureId;
    } catch (_) {
      return ventureId;
    }
  }
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

/** Ordered stages for a Venture — only Venture-facing columns.
 *
 * Archived (soft-deleted) journeys are hidden by default; management
 * surfaces pass { includeArchived: true }. Falls back to the pre-archive
 * column set when the archive columns have not been migrated yet.
 */
export async function listJourneyStages(db, dbId, { includeArchived = false } = {}) {
  const baseCols = `id, name, description, objective, target_date, stage_order,
                 status, completed_at, created_at`;
  const run = (withArchive) => {
    const cols = withArchive ? `${baseCols}, is_archived, archived_at` : baseCols;
    const where = withArchive && !includeArchived ? " AND (is_archived = FALSE OR is_archived IS NULL)" : "";
    return db.execute({
      sql: `SELECT ${cols}
            FROM venture_journey_stages WHERE venture_id = ?${where}
            ORDER BY stage_order ASC`,
      args: [dbId],
    });
  };
  try {
    const res = await run(true);
    return res.rows || [];
  } catch (_) {
    const res = await run(false);
    return res.rows || [];
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
    const idx = list.findIndex((r) => r.id === stageId);
    if (idx === -1) return { error: "Stage not found." };
    const targetIdx = direction === "up" ? idx - 1 : direction === "down" ? idx + 1 : -1;
    if (targetIdx < 0 || targetIdx >= list.length) return { error: "Already at the edge." };

    const a = list[idx];
    const b = list[targetIdx];
    // Park one order at a negative sentinel (orders are positive 1..n), then
    // swap — unique constraint is satisfied after every statement.
    await query("UPDATE venture_journey_stages SET stage_order = -1 WHERE id = ?", [a.id]);
    await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [a.stage_order, b.id]);
    await query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [b.stage_order, a.id]);
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
