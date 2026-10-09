import db from "@/lib/db";

/**
 * Lead Manager dashboard reads (REPOSITORY layer).
 *
 * Every query is scoped to Venture codes the caller already owns as an active
 * `lead_manager` — the service decides which codes; this file only fetches.
 */

/** Active lead_manager assignments for one staff contact, with Venture facts. */
export function selectLeadManagerVentures(staffCid) {
  return db.execute({
    sql: `SELECT a.id AS assignment_id, a.responsibility_code, a.scope_type, a.scope_ref_type,
                 a.scope_ref_id, a.created_at AS assigned_at,
                 v.id AS venture_db_id, v.venture_id, v.company_name, v.name,
                 v.status, v.business_stage, v.industry, v.country, v.updated_at
          FROM venture_staff_assignments a
          JOIN ventures v ON v.venture_id = a.venture_id
          WHERE a.staff_contact_id = ?
            AND a.status = 'active'
            AND a.responsibility_code = 'lead_manager'
          ORDER BY COALESCE(v.company_name, v.name) ASC NULLS LAST, a.id DESC`,
    args: [String(staffCid)],
  });
}

/** Milestone health across a set of Venture db ids. */
export function selectMilestonesForLeadVentures(dbIds = []) {
  const ids = (Array.isArray(dbIds) ? dbIds : []).map(String).filter(Boolean);
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  return db.execute({
    sql: `SELECT m.id, m.venture_id, m.title, m.status, m.target_date, m.progress,
                 m.journey_stage_id, m.updated_at
          FROM venture_milestones m
          WHERE m.venture_id::text IN (${ids.map(() => "?").join(", ")})
          ORDER BY m.target_date ASC NULLS LAST, m.updated_at DESC NULLS LAST`,
    args: ids,
  });
}

/** Live journey stages for Venture db ids (archive-aware when the column exists). */
export function selectStagesForLeadVentures(dbIds = []) {
  const ids = (Array.isArray(dbIds) ? dbIds : []).map(String).filter(Boolean);
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  return db.execute({
    sql: `SELECT s.id, s.venture_id, s.name, s.status, s.stage_order, s.start_date, s.target_date
          FROM venture_journey_stages s
          WHERE s.venture_id::text IN (${ids.map(() => "?").join(", ")})
            AND COALESCE(s.is_archived, FALSE) = FALSE
          ORDER BY s.venture_id, s.stage_order ASC`,
    args: ids,
  }).catch(() =>
    db.execute({
      sql: `SELECT s.id, s.venture_id, s.name, s.status, s.stage_order, s.start_date, s.target_date
            FROM venture_journey_stages s
            WHERE s.venture_id::text IN (${ids.map(() => "?").join(", ")})
            ORDER BY s.venture_id, s.stage_order ASC`,
      args: ids,
    }),
  );
}

/** Task submissions awaiting review across Venture db ids (Lead Manager inbox). */
export function selectReviewQueueForLeadVentures(dbIds = [], limit = 50) {
  const ids = (Array.isArray(dbIds) ? dbIds : []).map(String).filter(Boolean);
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  return db.execute({
    sql: `SELECT s.id AS submission_id, s.task_id, s.version, s.file_url, s.file_name, s.notes,
                 s.submitted_by_name, s.created_at,
                 t.title AS task_title, t.venture_id AS task_venture_db_id, t.milestone_id,
                 m.title AS milestone_title
          FROM venture_task_submissions s
          JOIN venture_tasks t ON t.id = s.task_id
          LEFT JOIN venture_milestones m ON m.id::text = t.milestone_id::text
          WHERE t.venture_id::text IN (${ids.map(() => "?").join(", ")})
            AND s.review_decision IS NULL
            AND s.version = (
              SELECT MAX(s2.version) FROM venture_task_submissions s2 WHERE s2.task_id = s.task_id
            )
          ORDER BY s.created_at ASC
          LIMIT ${safeLimit}`,
    args: ids,
  });
}

/** Deliverables sitting in review across Venture db ids. */
export function selectDeliverablesAwaitingReview(dbIds = [], limit = 50) {
  const ids = (Array.isArray(dbIds) ? dbIds : []).map(String).filter(Boolean);
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  return db.execute({
    sql: `SELECT d.id, d.venture_id, d.milestone_id, d.title, d.status, d.approval_status,
                 d.updated_at, d.due_date
          FROM venture_deliverables d
          WHERE d.venture_id::text IN (${ids.map(() => "?").join(", ")})
            AND (
              LOWER(COALESCE(d.status, '')) IN ('submitted', 'under_review', 'review')
              OR LOWER(COALESCE(d.approval_status, '')) IN ('pending', 'submitted', 'under_review')
            )
          ORDER BY d.updated_at ASC NULLS LAST
          LIMIT ${safeLimit}`,
    args: ids,
  }).catch(() => ({ rows: [] }));
}

/**
 * Upcoming / recent sessions for Venture codes (sessions store the VNT code).
 * `fromIso` / `toIso` are inclusive bounds on start_time.
 */
export function selectSessionsForLeadVentures({ codes = [], fromIso, toIso, limit = 40 } = {}) {
  const list = (Array.isArray(codes) ? codes : []).map(String).filter(Boolean);
  if (list.length === 0) return Promise.resolve({ rows: [] });
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  return db.execute({
    sql: `SELECT s.id, s.venture_id, s.title, s.start_time, s.end_time, s.status,
                 s.milestone_id, s.journey_stage_id
          FROM venture_sessions s
          WHERE s.venture_id::text IN (${list.map(() => "?").join(", ")})
            AND COALESCE(LOWER(s.status), '') <> 'cancelled'
            AND s.start_time >= ?::timestamptz
            AND s.start_time < ?::timestamptz
          ORDER BY s.start_time ASC
          LIMIT ${safeLimit}`,
    args: [...list, fromIso, toIso],
  }).catch(() => ({ rows: [] }));
}

/** Session ids that already have at least one memo/note. */
export function selectSessionIdsWithNotes(sessionIds = []) {
  const ids = (Array.isArray(sessionIds) ? sessionIds : []).map(Number).filter((n) => Number.isFinite(n));
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  return db.execute({
    sql: `SELECT DISTINCT session_id
          FROM venture_session_notes
          WHERE session_id IN (${ids.map(() => "?").join(", ")})`,
    args: ids,
  }).catch(() => ({ rows: [] }));
}

/** Latest activity timestamp per Venture code. */
export function selectLastActivityByVentureCodes(codes = []) {
  const list = (Array.isArray(codes) ? codes : []).map(String).filter(Boolean);
  if (list.length === 0) return Promise.resolve({ rows: [] });
  return db.execute({
    sql: `SELECT venture_id::text AS venture_id, MAX(created_at) AS last_activity_at
          FROM venture_activity_log
          WHERE venture_id::text IN (${list.map(() => "?").join(", ")})
          GROUP BY venture_id::text`,
    args: list,
  }).catch(() => ({ rows: [] }));
}

/** Draft / pending journey reports for Venture codes (when the table exists). */
export function selectPendingJourneyReports(codes = [], limit = 30) {
  const list = (Array.isArray(codes) ? codes : []).map(String).filter(Boolean);
  if (list.length === 0) return Promise.resolve({ rows: [] });
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 80);
  return db.execute({
    sql: `SELECT r.id, r.venture_id, r.title, r.status, r.updated_at, r.created_at
          FROM venture_reports r
          WHERE r.venture_id::text IN (${list.map(() => "?").join(", ")})
            AND LOWER(COALESCE(r.status, '')) IN ('draft', 'pending', 'in_progress', 'due')
          ORDER BY r.updated_at ASC NULLS LAST
          LIMIT ${safeLimit}`,
    args: list,
  }).catch(() => ({ rows: [] }));
}
