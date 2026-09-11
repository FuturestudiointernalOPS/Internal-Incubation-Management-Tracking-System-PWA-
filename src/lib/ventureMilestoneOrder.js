/**
 * Milestone ordering inside a Journey stage (Vinance 3 — Phase 1 of the
 * "milestones live inside the journey" work).
 *
 * Milestones belong to a stage via journey_stage_id and are ordered by
 * display_order. Legacy rows may have a NULL display_order, so every move
 * first normalizes the list to 1..n, then swaps the two affected positions —
 * this keeps the sequence deterministic no matter what the rows contained.
 */

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** Stage milestones in display order (NULL orders fall back to creation time). */
export async function listStageMilestones(db, { dbId, stageId }) {
  const res = await db.execute({
    sql: `SELECT id, title, status, progress, target_date, display_order, created_at
          FROM venture_milestones
          WHERE venture_id = ? AND journey_stage_id = ?
          ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`,
    args: [dbId, String(stageId)],
  }).catch(() => ({ rows: [] }));
  return rowsOf(res);
}

/**
 * Move a milestone one position up/down inside its stage.
 * Returns { success: true } or { error }.
 */
export async function moveStageMilestone(db, { dbId, stageId, milestoneId, direction }) {
  return db.transaction(async (query) => {
    const rows = await query(
      `SELECT id, display_order FROM venture_milestones
       WHERE venture_id = ? AND journey_stage_id = ?
       ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`,
      [dbId, String(stageId)],
    );
    const list = rowsOf(rows);
    const idx = list.findIndex((r) => String(r.id) === String(milestoneId));
    if (idx === -1) return { error: "Milestone not found in this journey." };

    const targetIdx = direction === "up" ? idx - 1 : direction === "down" ? idx + 1 : -1;
    if (targetIdx < 0 || targetIdx >= list.length) return { error: "Already at the edge." };

    // Normalize 1..n first so a swap always lands on concrete values.
    for (let i = 0; i < list.length; i += 1) {
      await query("UPDATE venture_milestones SET display_order = ? WHERE id = ?", [i + 1, list[i].id]);
    }
    await query("UPDATE venture_milestones SET display_order = ? WHERE id = ?", [targetIdx + 1, list[idx].id]);
    await query("UPDATE venture_milestones SET display_order = ? WHERE id = ?", [idx + 1, list[targetIdx].id]);
    return { success: true };
  });
}

export default { listStageMilestones, moveStageMilestone };
