/**
 * VENTURE FUNDRAISING PIPELINE.
 *
 * The opportunity catalogue (list / read with its stage history, activities and
 * notes), the create with its input guards and initial stage row, the update
 * with stage-change tracking, the delete, the notes and activities, and the
 * pipeline analytics.
 *
 * The decisions — the amount/close-date guards, the stage-change tracking, the
 * JSON wrapping of tags and the win-rate maths — live here; every statement is in
 * `@/models/ventureFundraisingStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  selectOpportunities,
  selectOpportunityById,
  selectOpportunityStageHistory,
  selectOpportunityActivities,
  selectOpportunityNotes,
  insertOpportunity,
  insertInitialStageHistory,
  selectOpportunityStageAndProbability,
  insertStageHistoryChange,
  updateOpportunityColumns,
  deleteOpportunityRow,
  insertOpportunityNote,
  insertOpportunityActivity,
  selectPipelineByStage,
  selectPipelineTotals,
} from "@/models/ventureFundraisingStore";

export const ACTIVITY_TYPES = ["email", "call", "meeting", "demo", "reminder", "follow_up", "task"];

/**
 * List opportunities for a venture, optionally by stage.
 */
export async function listOpportunities(ventureId, stage) {
  return (await selectOpportunities(ventureId, stage)).rows || [];
}

export async function getOpportunity(oppId) {
  const [oRes, hRes, aRes, nRes] = await Promise.all([
    selectOpportunityById(oppId),
    selectOpportunityStageHistory(oppId),
    selectOpportunityActivities(oppId),
    selectOpportunityNotes(oppId),
  ]);
  if (oRes.rows.length === 0) return null;
  return { ...oRes.rows[0], stage_history: hRes.rows||[], activities: aRes.rows||[], notes: nRes.rows||[] };
}

export async function createOpportunity({ ventureId, investorId, investorName, investorEmail, expectedAmount, currency, probability, expectedCloseDate, ownerCid, ownerName, tags, nextAction, nextActionDate, createdBy }) {
  if (expectedAmount && expectedAmount < 0) throw new Error("Amount cannot be negative.");
  if (expectedCloseDate && new Date(expectedCloseDate) < new Date(new Date().toDateString())) throw new Error("Close date cannot be in the past.");

  const id = (await insertOpportunity({
    ventureId,
    investorId: investorId||null,
    investorName: investorName||null,
    investorEmail: investorEmail||null,
    expectedAmount: expectedAmount||null,
    currency: currency||"USD",
    probability: probability||10,
    expectedCloseDate: expectedCloseDate||null,
    ownerCid: ownerCid||null,
    ownerName: ownerName||null,
    tagsJson: JSON.stringify(tags||[]),
    nextAction: nextAction||null,
    nextActionDate: nextActionDate||null,
    createdBy: createdBy||"system",
  })).rows[0]?.id;

  // Log initial stage
  await insertInitialStageHistory(id, probability||10, createdBy||"system");

  return { id };
}

export async function updateOpportunity(oppId, updates) {
  const allowed = ["investor_id", "investor_name", "investor_email", "stage", "expected_amount", "currency", "probability", "expected_close_date", "owner_cid", "owner_name", "tags", "next_action", "next_action_date", "notes_summary"];
  const sets = []; const args = [];

  // Track stage changes
  if (updates.stage) {
    const current = await selectOpportunityStageAndProbability(oppId);
    if (current.rows.length > 0 && current.rows[0].stage !== updates.stage) {
      await insertStageHistoryChange(oppId, current.rows[0].stage, updates.stage, updates.probability||current.rows[0].probability, updates._changed_by||"system", updates._stage_change_notes||null);
    }
  }

  for (const column of allowed) {
    if (updates[column] !== undefined) {
      if (column === "tags") { sets.push("tags=?::jsonb"); args.push(JSON.stringify(updates[column])); }
      else { sets.push(`${column}=?`); args.push(updates[column]); }
    }
  }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at=NOW()"); args.push(oppId);
  await updateOpportunityColumns(sets, args);
  return { updated: true };
}

export async function deleteOpportunity(oppId) {
  await deleteOpportunityRow(oppId);
  return { success: true };
}

export async function addOpportunityNote({ opportunityId, content, authorCid, authorName }) {
  const id = (await insertOpportunityNote(opportunityId, content, authorCid||null, authorName||null)).rows[0]?.id;
  return { id };
}

export async function addOpportunityActivity({ opportunityId, activityType, title, description, activityDate, createdBy }) {
  const id = (await insertOpportunityActivity(opportunityId, activityType, title, description||null, activityDate||new Date().toISOString(), createdBy||"system")).rows[0]?.id;
  return { id };
}

/**
 * Get pipeline analytics (value by stage).
 */
export async function getPipelineAnalytics(ventureId) {
  const stages = await selectPipelineByStage(ventureId);

  const total = await selectPipelineTotals(ventureId);

  const totals = total.rows[0] || {};
  return {
    by_stage: stages.rows || [],
    total_opportunities: parseInt(totals.total_opps) || 0,
    total_pipeline_value: parseFloat(totals.total_pipeline) || 0,
    won: parseInt(totals.won) || 0,
    lost: parseInt(totals.lost) || 0,
    win_rate: (parseInt(totals.won) + parseInt(totals.lost)) > 0
      ? Math.round((parseInt(totals.won) / (parseInt(totals.won) + parseInt(totals.lost))) * 100) : 0,
  };
}
