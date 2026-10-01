/**
 * Venture fundraising pipeline — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/fundraising`: the opportunity
 * catalogue and its stage history / activities / notes, the stage-change writes,
 * the dynamic opportunity UPDATE and the pipeline analytics reads.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Opportunities ────────────────────────────────────────────────────────────

/** A Venture's fundraising opportunities (optional stage filter). */
export function selectOpportunities(ventureId, stage) {
  let sql = `SELECT fo.*, fi.name as ref_investor_name, fi.organization as ref_organization
             FROM fundraising_opportunities fo
             LEFT JOIN venture_investors fi ON fo.investor_id = fi.id
             WHERE fo.venture_id=?`;
  const args = [ventureId];
  if (stage) { sql += " AND fo.stage=?"; args.push(stage); }
  sql += " ORDER BY fo.expected_close_date ASC, fo.created_at DESC";
  return db.execute({ sql, args });
}

/** One opportunity with its investor join. */
export function selectOpportunityById(oppId) {
  return db.execute({ sql: `SELECT fo.*, fi.name as ref_investor_name, fi.organization as ref_organization FROM fundraising_opportunities fo LEFT JOIN venture_investors fi ON fo.investor_id = fi.id WHERE fo.id=?`, args: [oppId] });
}

/** An opportunity's stage history, newest first. */
export function selectOpportunityStageHistory(oppId) {
  return db.execute({ sql: "SELECT * FROM fundraising_stage_history WHERE opportunity_id=? ORDER BY created_at DESC", args: [oppId] });
}

/** An opportunity's activities, newest first. */
export function selectOpportunityActivities(oppId) {
  return db.execute({ sql: "SELECT * FROM fundraising_activities WHERE opportunity_id=? ORDER BY activity_date DESC", args: [oppId] });
}

/** An opportunity's notes, newest first. */
export function selectOpportunityNotes(oppId) {
  return db.execute({ sql: "SELECT * FROM fundraising_notes WHERE opportunity_id=? ORDER BY created_at DESC", args: [oppId] });
}

/** Insert one opportunity, returning its id. */
export function insertOpportunity({
  ventureId, investorId, investorName, investorEmail, expectedAmount, currency, probability,
  expectedCloseDate, ownerCid, ownerName, tagsJson, nextAction, nextActionDate, createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO fundraising_opportunities (venture_id, investor_id, investor_name, investor_email, expected_amount, currency, probability, expected_close_date, owner_cid, owner_name, tags, next_action, next_action_date, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?) RETURNING id`,
    args: [ventureId, investorId, investorName, investorEmail, expectedAmount, currency, probability, expectedCloseDate, ownerCid, ownerName, tagsJson, nextAction, nextActionDate, createdBy],
  });
}

// ── Stage history ────────────────────────────────────────────────────────────

/** Record the initial 'prospect' stage for a new opportunity. */
export function insertInitialStageHistory(oppId, probability, changedBy) {
  return db.execute({
    sql: `INSERT INTO fundraising_stage_history (opportunity_id, previous_stage, new_stage, probability, changed_by) VALUES (?, NULL, 'prospect', ?, ?)`,
    args: [oppId, probability, changedBy],
  });
}

/** The current stage + probability of an opportunity. */
export function selectOpportunityStageAndProbability(oppId) {
  return db.execute({ sql: "SELECT stage, probability FROM fundraising_opportunities WHERE id=?", args: [oppId] });
}

/** Record a stage change. */
export function insertStageHistoryChange(oppId, previousStage, newStage, probability, changedBy, notes) {
  return db.execute({
    sql: `INSERT INTO fundraising_stage_history (opportunity_id, previous_stage, new_stage, probability, changed_by, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [oppId, previousStage, newStage, probability, changedBy, notes],
  });
}

/** Apply a computed SET list to an opportunity. */
export function updateOpportunityColumns(sets, args) {
  return db.execute({ sql: `UPDATE fundraising_opportunities SET ${sets.join(",")} WHERE id=?`, args });
}

/** Delete one opportunity. */
export function deleteOpportunityRow(oppId) {
  return db.execute({ sql: "DELETE FROM fundraising_opportunities WHERE id=?", args: [oppId] });
}

// ── Notes + activities ───────────────────────────────────────────────────────

/** Insert one opportunity note, returning its id. */
export function insertOpportunityNote(opportunityId, content, authorCid, authorName) {
  return db.execute({
    sql: `INSERT INTO fundraising_notes (opportunity_id, content, author_cid, author_name) VALUES (?, ?, ?, ?) RETURNING id`,
    args: [opportunityId, content, authorCid, authorName],
  });
}

/** Insert one opportunity activity, returning its id. */
export function insertOpportunityActivity(opportunityId, activityType, title, description, activityDate, createdBy) {
  return db.execute({
    sql: `INSERT INTO fundraising_activities (opportunity_id, activity_type, title, description, activity_date, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [opportunityId, activityType, title, description, activityDate, createdBy],
  });
}

// ── Pipeline analytics ───────────────────────────────────────────────────────

/** Opportunity counts + values grouped by stage. */
export function selectPipelineByStage(ventureId) {
  return db.execute({
    sql: `SELECT stage, COUNT(*) as count, COALESCE(SUM(expected_amount), 0) as total_value,
       AVG(probability) as avg_probability
       FROM fundraising_opportunities WHERE venture_id=? GROUP BY stage ORDER BY
       CASE stage WHEN 'prospect' THEN 0 WHEN 'contacted' THEN 1 WHEN 'meeting_scheduled' THEN 2
       WHEN 'pitch_delivered' THEN 3 WHEN 'due_diligence' THEN 4 WHEN 'negotiation' THEN 5
       WHEN 'term_sheet' THEN 6 WHEN 'closed_won' THEN 7 WHEN 'closed_lost' THEN 8 ELSE 9 END`,
    args: [ventureId],
  });
}

/** Pipeline totals for a Venture. */
export function selectPipelineTotals(ventureId) {
  return db.execute({
    sql: `SELECT COUNT(*) as total_opps, COALESCE(SUM(expected_amount), 0) as total_pipeline,
       SUM(CASE WHEN stage='closed_won' THEN 1 ELSE 0 END) as won,
       SUM(CASE WHEN stage='closed_lost' THEN 1 ELSE 0 END) as lost
       FROM fundraising_opportunities WHERE venture_id=?`,
    args: [ventureId],
  });
}
