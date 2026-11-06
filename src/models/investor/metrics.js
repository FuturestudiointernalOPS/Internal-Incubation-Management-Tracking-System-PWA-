import db from "@/lib/db";

// Preserve historic numeric identities; new UUID identities live in the
// immutable, server-owned event snapshot. Staff and test traffic never count.
const METRIC_ACTIVITY_SOURCE = `(SELECT
  COALESCE(metadata->>'investor_ref', investor_id::text) AS investor_id,
  venture_id, event_type, occurred_at, metadata
  FROM investor_activity_log
  WHERE actor_type = 'investor'
    AND COALESCE(metadata->>'is_test', 'false') <> 'true') AS metric_activity`;

// ── Phase 8 — metrics projections (read-only) ────────────────────────────────

export async function countActivityByType({ from = null, to = null } = {}) {
  const where = [];
  const args = [];
  if (from) {
    where.push("occurred_at >= ?");
    args.push(from);
  }
  if (to) {
    where.push("occurred_at <= ?");
    args.push(to);
  }
  return db.execute({
    sql: `SELECT event_type, COUNT(*)::int AS count
            FROM ${METRIC_ACTIVITY_SOURCE}
            ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
           GROUP BY event_type`,
    args,
  });
}

/** Per-investor lifecycle timestamps, plus the medians computed in SQL. */
export async function selectConversionPairs() {
  return db.execute({
    sql: `WITH pairs AS (
            SELECT investor_id,
              MIN(occurred_at) FILTER (WHERE event_type = 'application_submitted') AS submitted_at,
              MIN(occurred_at) FILTER (WHERE event_type = 'application_approved') AS approved_at,
              MIN(occurred_at) FILTER (WHERE event_type = 'activation_email_sent') AS email_at,
              MIN(occurred_at) FILTER (WHERE event_type = 'account_activated') AS activated_at
            FROM ${METRIC_ACTIVITY_SOURCE}
           GROUP BY investor_id
         )
         SELECT
           COUNT(*) FILTER (WHERE approved_at IS NOT NULL)::int AS approved,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 86400)
             FILTER (WHERE approved_at IS NOT NULL AND submitted_at IS NOT NULL) AS median_days_to_approve,
           COUNT(*) FILTER (WHERE activated_at IS NOT NULL)::int AS activated,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (activated_at - email_at)) / 86400)
             FILTER (WHERE activated_at IS NOT NULL AND email_at IS NOT NULL) AS median_days_to_activate
         FROM pairs`,
    args: [],
  });
}

export async function countProfiles() {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE approval_status = 'approved')::int AS approved,
                 COUNT(*) FILTER (WHERE approval_status = 'pending_review')::int AS pending
            FROM investor_profiles`,
    args: [],
  });
}

export async function countProfilesByVisibilityMode() {
  return db.execute({
    sql: `SELECT COALESCE(visibility_mode, 'deal_flow_only') AS visibility_mode, COUNT(*)::int AS count
            FROM investor_profiles GROUP BY 1`,
    args: [],
  });
}

export async function countProfilesBySource() {
  return db.execute({
    sql: `SELECT COALESCE(source, 'unknown') AS source, COUNT(*)::int AS count
            FROM investor_profiles GROUP BY 1`,
    args: [],
  });
}

export async function countActiveInvestors(days = 30) {
  return db.execute({
    sql: `SELECT COUNT(DISTINCT investor_id)::int AS count
            FROM ${METRIC_ACTIVITY_SOURCE}
           WHERE event_type = 'login' AND occurred_at >= NOW() - (? || ' days')::interval`,
    args: [String(days)],
  });
}

export async function getInvitationStats() {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS sent,
                 COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
                 COUNT(*) FILTER (WHERE submitted_at IS NOT NULL)::int AS submitted
            FROM investor_invitations`,
    args: [],
  });
}

export async function getDealFlowStats() {
  return db.execute({
    sql: `SELECT COUNT(*) FILTER (WHERE status = 'live')::int AS live_count,
                 COALESCE(SUM(target_amount) FILTER (WHERE status = 'live'), 0)::float AS live_target_total,
                 COUNT(*)::int AS total_entries,
                 COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_entries,
                 COUNT(*) FILTER (WHERE status = 'closed' AND close_reason = 'raised')::int AS raised_entries
            FROM deal_flow_entries`,
    args: [],
  });
}

export async function getDealFlowAge() {
  return db.execute({
    sql: `SELECT percentile_cont(0.5) WITHIN GROUP (
                   ORDER BY EXTRACT(EPOCH FROM (COALESCE(closed_at, NOW()) - opened_at)) / 86400
                 ) FILTER (WHERE opened_at IS NOT NULL) AS median_days
            FROM deal_flow_entries`,
    args: [],
  });
}

export async function getDealFlowOutcomes() {
  return db.execute({
    sql: `SELECT COALESCE(close_reason, 'open') AS reason, COUNT(*)::int AS count
            FROM deal_flow_entries WHERE status = 'closed'
           GROUP BY 1 ORDER BY count DESC`,
    args: [],
  });
}

export async function getDeckReadiness() {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS entries,
                 COUNT(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM deal_flow_decks d
                    WHERE d.deal_flow_entry_id = e.id AND d.status = 'published'
                 ))::int AS with_published_deck
            FROM deal_flow_entries e`,
    args: [],
  });
}

export async function getEngagementStats() {
  return db.execute({
    sql: `SELECT COUNT(*) FILTER (WHERE event_type = 'venture_viewed')::int AS venture_views,
                 COUNT(DISTINCT investor_id) FILTER (WHERE event_type = 'venture_viewed')::int AS unique_viewers,
                 COUNT(*) FILTER (WHERE event_type = 'deck_opened')::int AS deck_opens,
                 COUNT(DISTINCT investor_id) FILTER (WHERE event_type = 'deck_opened')::int AS unique_deck_openers,
                 COUNT(*) FILTER (WHERE event_type = 'interest_expressed')::int AS interests,
                 COUNT(*) FILTER (WHERE event_type = 'watchlist_added')::int AS watchlist_adds,
                 COUNT(*) FILTER (WHERE event_type = 'compare_used')::int AS compares
            FROM ${METRIC_ACTIVITY_SOURCE}`,
    args: [],
  });
}

export async function getIntroStats() {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS requested,
                 COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
                 COUNT(*) FILTER (WHERE status = 'declined')::int AS declined,
                 COUNT(*) FILTER (WHERE status IN ('submitted', 'under_review'))::int AS backlog,
                 percentile_cont(0.5) WITHIN GROUP (
                   ORDER BY EXTRACT(EPOCH FROM (decided_at - requested_at)) / 3600
                 ) FILTER (WHERE decided_at IS NOT NULL) AS median_hours_to_decide
            FROM investor_introduction_requests`,
    args: [],
  });
}

export async function getDeclineReasons() {
  return db.execute({
    sql: `SELECT COALESCE(decline_reason, 'unknown') AS reason, COUNT(*)::int AS count
            FROM investor_introduction_requests WHERE status = 'declined'
           GROUP BY 1 ORDER BY count DESC`,
    args: [],
  });
}

export async function getPipelineByStage() {
  return db.execute({
    sql: "SELECT stage, COUNT(*)::int AS count FROM investment_pipeline GROUP BY stage",
    args: [],
  });
}

export async function getPipelineTotals() {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS pairs,
                 COUNT(*) FILTER (WHERE stage = 'invested')::int AS invested
            FROM investment_pipeline`,
    args: [],
  });
}

export async function getMeetingStats() {
  return db.execute({
    sql: `SELECT COUNT(*) FILTER (WHERE status = 'held')::int AS held,
                 COUNT(*) FILTER (WHERE status = 'no_show')::int AS no_show,
                 COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                 COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed
            FROM relationship_meetings`,
    args: [],
  });
}

export async function getInvestmentStats() {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float AS total FROM investor_investments",
    args: [],
  });
}

export async function getFinancingStats() {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS count,
                 COALESCE(SUM(amount_value) FILTER (WHERE amount_mode = 'exact'), 0)::float AS total
            FROM venture_event_log
           WHERE event_type = 'financing_received' AND deleted_at IS NULL`,
    args: [],
  });
}

// ── Stage history, time-to-close, scheduling, losses ─────────────────────────

/** First timestamp at each stage, per investor-venture pair. */
export async function getStageTransitions() {
  return db.execute({
    sql: `SELECT investor_id, venture_id, metadata->>'stage' AS stage, MIN(occurred_at) AS first_at
            FROM ${METRIC_ACTIVITY_SOURCE}
           WHERE event_type = 'pipeline_stage_changed' AND investor_id IS NOT NULL
           GROUP BY 1, 2, 3`,
    args: [],
  });
}

/** Distinct investor-venture pairs that expressed interest. */
export async function getInterestPairs() {
  return db.execute({
    sql: `SELECT COUNT(DISTINCT (investor_id, venture_id))::int AS count
            FROM ${METRIC_ACTIVITY_SOURCE}
           WHERE event_type = 'interest_expressed' AND investor_id IS NOT NULL`,
    args: [],
  });
}

/** E5 — median days from the first intro request to the recorded investment. */
export async function getTimeToClose() {
  return db.execute({
    sql: `WITH pairs AS (
            SELECT investor_profile_id, venture_id, MIN(requested_at) AS first_request
              FROM investor_introduction_requests
             WHERE investor_profile_id IS NOT NULL
             GROUP BY investor_profile_id, venture_id
          ),
          closed AS (
            SELECT p.first_request, MIN(ip.stage_changed_at) AS closed_at
              FROM pairs p
              JOIN investment_pipeline ip
                ON ip.investor_id = p.investor_profile_id
               AND ip.venture_id::text = p.venture_id
               AND ip.stage = 'invested'
               AND ip.stage_changed_at >= p.first_request
             GROUP BY p.investor_profile_id, p.venture_id, p.first_request
          )
          SELECT percentile_cont(0.5) WITHIN GROUP (
                   ORDER BY EXTRACT(EPOCH FROM (closed_at - first_request)) / 86400
                 ) AS median_days,
                 COUNT(*)::int AS pairs
            FROM closed`,
    args: [],
  });
}

/** D4/D5 — approved intro → confirmed meeting, and request → meeting start. */
export async function getIntroMeetingTimings() {
  return db.execute({
    sql: `SELECT
            percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (m.start_at - ir.decided_at)) / 3600
            ) FILTER (WHERE ir.decided_at IS NOT NULL AND m.start_at IS NOT NULL) AS median_hours_approved_to_meeting,
            percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (m.start_at - ir.requested_at)) / 86400
            ) FILTER (WHERE m.start_at IS NOT NULL) AS median_days_request_to_meeting
          FROM investor_introduction_requests ir
          JOIN relationship_meetings m ON m.workspace_id = ir.workspace_id
         WHERE ir.status = 'approved' AND ir.workspace_id IS NOT NULL`,
    args: [],
  });
}

/** D8 — reschedules against confirmations. */
export async function getRescheduleStats() {
  return db.execute({
    sql: `SELECT COUNT(*) FILTER (WHERE event_type = 'meeting_confirmed')::int AS confirmed,
                 COUNT(*) FILTER (WHERE event_type = 'meeting_rescheduled')::int AS rescheduled
            FROM ${METRIC_ACTIVITY_SOURCE}`,
    args: [],
  });
}

/** E8 — pairs lost, by reason. */
export async function getLossReasons() {
  return db.execute({
    sql: `SELECT COALESCE(metadata->>'reason', 'unspecified') AS reason, COUNT(*)::int AS count
            FROM ${METRIC_ACTIVITY_SOURCE}
           WHERE event_type IN ('pipeline_declined', 'pipeline_withdrawn')
           GROUP BY 1 ORDER BY count DESC`,
    args: [],
  });
}

/** D10 — approved intros whose pair reached due diligence or beyond. */
export async function getIntroToDiligence() {
  return db.execute({
    sql: `WITH approved AS (
            SELECT investor_profile_id AS investor_id, venture_id
              FROM investor_introduction_requests
             WHERE status = 'approved' AND investor_profile_id IS NOT NULL AND venture_id IS NOT NULL
          ),
          reached AS (
            SELECT a.investor_id, a.venture_id
              FROM approved a
              JOIN investment_pipeline ip
                ON ip.investor_id = a.investor_id
               AND CAST(ip.venture_id AS TEXT) = CAST(a.venture_id AS TEXT)
             WHERE ip.stage IN ('due_diligence', 'negotiation', 'invested')
             GROUP BY 1, 2
          )
          SELECT (SELECT COUNT(*)::int FROM approved) AS approved,
                 (SELECT COUNT(*)::int FROM reached) AS reached`,
    args: [],
  });
}
