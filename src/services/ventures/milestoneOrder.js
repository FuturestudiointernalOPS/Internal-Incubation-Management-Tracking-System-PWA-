/**
 * MILESTONE ORDERING inside a Journey stage (Vinance 3 — Phase 1).
 *
 * Milestones belong to a stage via journey_stage_id and are ordered by
 * display_order. Legacy rows may have a NULL display_order, so every move first
 * normalizes the list to 1..n, then swaps the two affected positions — this
 * keeps the sequence deterministic no matter what the rows contained.
 *
 * Every statement lives in `@/models/ventureMilestoneOrderStore`; nothing here
 * runs SQL. This module used to be re-exported through the `@/lib/ventureMilestoneOrder` facade;
 * that facade is gone (CH-4) and importers read this module directly.
 */

import {
  runInTransaction,
  selectStageMilestonesForOrder,
  selectStageMilestoneOrders,
  setMilestoneDisplayOrder,
} from "@/models/ventureMilestoneOrderStore";

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** Stage milestones in display order (NULL orders fall back to creation time). */
export async function listStageMilestones({ dbId, stageId }) {
  const result = await selectStageMilestonesForOrder(dbId, stageId).catch(() => ({ rows: [] }));
  return rowsOf(result);
}

/**
 * Move a milestone one position up/down inside its stage.
 * Returns { success: true } or { error }.
 */
export async function moveStageMilestone({ dbId, stageId, milestoneId, direction }) {
  return runInTransaction(async (query) => {
    const list = rowsOf(await selectStageMilestoneOrders(query, dbId, stageId));
    const currentIndex = list.findIndex((milestone) => String(milestone.id) === String(milestoneId));
    if (currentIndex === -1) return { error: "Milestone not found in this journey." };

    const targetIndex = direction === "up" ? currentIndex - 1 : direction === "down" ? currentIndex + 1 : -1;
    if (targetIndex < 0 || targetIndex >= list.length) return { error: "Already at the edge." };

    // Normalize 1..n first so a swap always lands on concrete values.
    for (let i = 0; i < list.length; i += 1) {
      await setMilestoneDisplayOrder(query, i + 1, list[i].id);
    }
    await setMilestoneDisplayOrder(query, targetIndex + 1, list[currentIndex].id);
    await setMilestoneDisplayOrder(query, currentIndex + 1, list[targetIndex].id);
    return { success: true };
  });
}
