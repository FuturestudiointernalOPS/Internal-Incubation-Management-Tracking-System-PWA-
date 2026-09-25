import db from "@/lib/db";
import { getWeekNumber } from "@/lib/constants";
import { calculateInvestmentReadiness } from "@/lib/ventures";
import {
  getTaskStatusStats,
  getBlockerStatusStats,
  getSubmittedReportCountsByWeek,
  getAvgBlockerResolutionSeconds,
  countActiveV2Programs,
  countParticipantContacts,
  countStaffContacts,
} from "@/models/adminOps";
import { getProgramKpiSummary } from "@/models/dashboard";

/**
 * src/models/intelligence.js — platform-wide aggregation engine behind the
 * /admin/intelligence page (GET /api/intelligence/metrics).
 *
 * All metric queries live here (MVC rule: no raw SQL inside route files).
 * Compute-only helpers are imported/reused from ../lib/ventures.js where it
 * makes sense; aggregates are pushed down to SQL to avoid per-venture loops.
 */

/**
 * Venture READINESS aggregates.
 *
 * Readiness is COMPUTED LIVE with the same engine the Venture pages use
 * (calculateInvestmentReadiness: 10 weighted categories over the venture's
 * profile/legal/financial/product/traction/market/model/team/tech/pitch data),
 * NOT read from the investment_assessments cache table (which is only written
 * when a single venture is evaluated and stays empty otherwise).
 */
export async function getVentureMetrics() {
  const [totalRes, overdueRes, venturesRes] = await Promise.all([
    db.execute({ sql: "SELECT COUNT(*)::int AS total FROM ventures" }),
    db.execute({
      sql: `SELECT COUNT(*)::int AS overdue
            FROM venture_milestones
            WHERE due_date IS NOT NULL AND due_date < NOW()
              AND status NOT IN ('completed', 'cancelled')`,
    }),
    db.execute({ sql: "SELECT venture_id FROM ventures ORDER BY venture_id" }),
  ]);

  const totalVentures = totalRes.rows[0]?.total ?? 0;
  const ventureIds = (venturesRes.rows || []).map((row) => row.venture_id);

  const readinessList = await Promise.all(
    ventureIds.map((id) => calculateInvestmentReadiness(id).catch(() => null)),
  );

  const scores = readinessList.filter(Boolean).map((r) => r.overall_score);
  const byLevel = { not_ready: 0, early_ready: 0, investment_ready: 0, fundraising_ready: 0 };
  for (const r of readinessList) {
    if (r && byLevel[r.investment_level] !== undefined) byLevel[r.investment_level] += 1;
  }

  const assessed = scores.length;

  return {
    total_ventures: totalVentures,
    overdue_milestones: overdueRes.rows[0]?.overdue ?? 0,
    readiness: {
      assessed,
      unassessed: Math.max(0, totalVentures - assessed),
      avg_score:
        scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0,
      by_level: byLevel,
    },
  };
}

/** Investor OS: pipeline distribution + fundraising totals. */
export async function getInvestorMetrics() {
  const [pipelineRes, fundraisingRes, relationshipsRes] = await Promise.all([
    db.execute({
      sql: `SELECT stage, COUNT(*)::int AS count
            FROM investment_pipeline
            GROUP BY stage
            ORDER BY count DESC`,
    }),
    db.execute({
      sql: `SELECT COALESCE(SUM(target_raise), 0)::float AS total_sought,
                   COALESCE(SUM(current_raised), 0)::float AS total_raised,
                   (SELECT COALESCE(SUM(investment_amount), 0)::float
                    FROM investment_decisions WHERE decision_type = 'invest') AS total_committed
            FROM fundraising_campaigns`,
    }),
    db.execute({
      sql: `SELECT (SELECT COUNT(*)::int FROM relationship_workspaces WHERE status = 'active') AS active_relationships,
                   (SELECT COUNT(*)::int FROM investment_pipeline WHERE stage = 'invested') AS total_invested`,
    }),
  ]);

  return {
    pipeline: pipelineRes.rows,
    fundraising: fundraisingRes.rows[0] || {},
    relationships: relationshipsRes.rows[0] || {},
  };
}

/** Operations OS: task/blocker status + weekly op-report compliance. */
export async function getOperationsMetrics() {
  const now = new Date();
  const week = getWeekNumber(now);
  const year = now.getFullYear();

  const [taskRes, blockerRes, reportRes, staffRes, resolutionRes] = await Promise.all([
    getTaskStatusStats(),
    getBlockerStatusStats(),
    getSubmittedReportCountsByWeek(week, year),
    countStaffContacts(),
    getAvgBlockerResolutionSeconds(),
  ]);

  const staff = staffRes.rows[0]?.count ?? 0;
  const standupsSubmitted = reportRes.rows[0]?.standups ?? 0;
  const retrosSubmitted = reportRes.rows[0]?.retros ?? 0;
  const tasks = taskRes.rows[0] || {};
  const totalTasks = tasks.total ?? 0;

  return {
    week,
    year,
    tasks,
    blockers: blockerRes.rows[0] || {},
    completion_rate: totalTasks > 0 ? Math.round(((tasks.completed ?? 0) / totalTasks) * 100) : 0,
    carryover_rate: totalTasks > 0 ? Math.round(((tasks.carried_over ?? 0) / totalTasks) * 100) : 0,
    avg_blocker_seconds: resolutionRes.rows[0]?.avg_seconds ?? null,
    report_compliance: {
      staff,
      standups_submitted: standupsSubmitted,
      standup_rate: staff > 0 ? Math.round((standupsSubmitted / staff) * 100) : 0,
      retros_submitted: retrosSubmitted,
      retro_rate: staff > 0 ? Math.round((retrosSubmitted / staff) * 100) : 0,
    },
  };
}

const HEALTH_THRESHOLDS = { on_track: 80, at_risk: 50 };

/**
 * Program health = average of execution (avg KPI rate) and engagement
 * (% of active participants with at least one submission). Same semantics as
 * the PROGRAM HEALTH page (thumbs: >=80 healthy, >=50 at risk, else critical).
 */
function computeProgramHealth(executionRate, engagementRate) {
  const hasExecution = Number.isFinite(executionRate);
  const hasEngagement = Number.isFinite(engagementRate);
  if (!hasExecution && !hasEngagement) {
    return { health_score: null, health_status: null };
  }
  const score = Math.round(
    ((hasExecution ? executionRate : 0) + (hasEngagement ? engagementRate : 0)) / 2,
  );
  const status =
    score >= HEALTH_THRESHOLDS.on_track ? "on_track" : score >= HEALTH_THRESHOLDS.at_risk ? "at_risk" : "critical";
  return { health_score: score, health_status: status };
}

/** Program OS: active programs + headcount + KPI rate + engagement/health. */
export async function getProgramMetrics() {
  const [programRes, staffRes, participantRes, kpiSummaryRes, submissionRes, membershipRes, deliverableRes] =
    await Promise.all([
      countActiveV2Programs(),
      countStaffContacts(),
      countParticipantContacts(),
      getProgramKpiSummary(),
      db.execute({
        sql: `SELECT program_id::text AS pid,
                     COUNT(DISTINCT participant_id) AS submitters,
                     COUNT(*)::int AS submission_count,
                     COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count
              FROM v2_submissions
              GROUP BY program_id::text`,
      }),
      db.execute({
        sql: `SELECT pp.program_id::text AS pid, COUNT(*)::int AS participants
              FROM participant_programs pp
              JOIN contacts c ON pp.participant_id = c.cid
              WHERE c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
                AND LOWER(COALESCE(c.status, '')) = 'active'
              GROUP BY pp.program_id::text`,
      }),
      db.execute({
        sql: `SELECT program_id::text AS pid, COUNT(*)::int AS deliverables
              FROM v2_document_requirements
              GROUP BY program_id::text`,
      }),
    ]);

  const byProgram = (map) => {
    const out = {};
    for (const row of map.rows || []) out[String(row.pid)] = row;
    return out;
  };
  const submissions = byProgram(submissionRes);
  const membership = byProgram(membershipRes);
  const deliverables = byProgram(deliverableRes);

  const kpis = (kpiSummaryRes.rows || []).map((kp) => {
    const pid = String(kp.id);
    const participants = Number(membership[pid]?.participants) || 0;
    const submitters = Number(submissions[pid]?.submitters) || 0;
    const approved = Number(submissions[pid]?.approved_count) || 0;
    const documentCount = Number(deliverables[pid]?.deliverables) || 0;
    const expected = participants * documentCount;

    const executionRate = Number.isFinite(parseFloat(kp.avg_kpi_rate))
      ? Math.round(parseFloat(kp.avg_kpi_rate))
      : NaN;
    const engagementRate = participants > 0 ? Math.round((submitters / participants) * 100) : NaN;
    const submissionRate = expected > 0 ? Math.min(100, Math.round((approved / expected) * 100)) : participants > 0 ? 0 : NaN;

    return {
      ...kp,
      participants,
      submitters,
      expected_submissions: expected,
      submission_rate: Number.isFinite(submissionRate) ? submissionRate : 0,
      engagement_rate: Number.isFinite(engagementRate) ? engagementRate : 0,
      ...computeProgramHealth(executionRate, engagementRate),
    };
  });

  return {
    active_programs: programRes.rows[0]?.count ?? 0,
    staff: staffRes.rows[0]?.count ?? 0,
    participants: participantRes.rows[0]?.count ?? 0,
    kpis,
  };
}

/**
 * CRM: contact registry + invitation/activation funnel.
 *
 * Mirrors EXACTLY what the CRM page (/admin/communications/contacts) shows —
 * contacts that are neither archived nor soft-deleted, with invitation status
 * derived the same way as attachInvitationStatus/deriveInvitationStatus:
 *  - activated   -> status 'active' OR a password is set
 *  - sent        -> not activated, has at least one unused token not yet expired
 *  - expired     -> not activated, has unused tokens but all expired
 *  - not_invited -> not activated, no unused token
 * (Tokens live in password_setup_tokens; the legacy v2_invitations table is NOT used.)
 */
export async function getContactMetrics() {
  const [contactsRes, last30Res, monthlyRes] = await Promise.all([
    db.execute({
      sql: `SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (
                WHERE LOWER(COALESCE(status, '')) = 'active'
                   OR (password IS NOT NULL AND length(password) > 0)
              )::int AS activated,
              COUNT(*) FILTER (
                WHERE LOWER(COALESCE(status, '')) <> 'active'
                  AND (password IS NULL OR length(password) = 0)
                  AND EXISTS (
                    SELECT 1 FROM password_setup_tokens t
                    WHERE t.contact_cid = c.cid AND t.used = 0 AND t.expires_at > NOW()
                  )
              )::int AS sent,
              COUNT(*) FILTER (
                WHERE LOWER(COALESCE(status, '')) <> 'active'
                  AND (password IS NULL OR length(password) = 0)
                  AND EXISTS (
                    SELECT 1 FROM password_setup_tokens t
                    WHERE t.contact_cid = c.cid AND t.used = 0
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM password_setup_tokens t
                    WHERE t.contact_cid = c.cid AND t.used = 0 AND t.expires_at > NOW()
                  )
              )::int AS expired,
              COUNT(*) FILTER (
                WHERE LOWER(COALESCE(status, '')) <> 'active'
                  AND (password IS NULL OR length(password) = 0)
                  AND NOT EXISTS (
                    SELECT 1 FROM password_setup_tokens t
                    WHERE t.contact_cid = c.cid AND t.used = 0
                  )
              )::int AS not_invited
            FROM contacts c
            WHERE c.archived_at IS NULL AND c.deleted_at IS NULL`,
    }),
    db.execute({
      sql: `SELECT COUNT(*)::int AS created_last_30d
            FROM contacts
            WHERE archived_at IS NULL AND deleted_at IS NULL
              AND created_at >= NOW() - INTERVAL '30 days'`,
    }),
    db.execute({
      sql: `SELECT to_char(created_at, 'YYYY-MM') AS month, COUNT(*)::int AS created
            FROM contacts
            WHERE archived_at IS NULL AND deleted_at IS NULL
              AND created_at >= NOW() - INTERVAL '6 months'
            GROUP BY to_char(created_at, 'YYYY-MM')
            ORDER BY month`,
    }),
  ]);

  const row = contactsRes.rows[0] || {};
  const total = row.total ?? 0;
  const activated = row.activated ?? 0;

  return {
    contacts: {
      total,
      activated,
      sent: row.sent ?? 0,
      expired: row.expired ?? 0,
      not_invited: row.not_invited ?? 0,
      activation_rate: total > 0 ? Math.round((activated / total) * 100) : 0,
    },
    growth: {
      total,
      created_last_30d: last30Res.rows[0]?.created_last_30d ?? 0,
      monthly: monthlyRes.rows,
    },
  };
}

/** Orchestrator: one call for the whole Intelligence page. */
export async function getIntelligenceMetrics() {
  const [ventures, investor, programs, operations, contacts] = await Promise.all([
    getVentureMetrics(),
    getInvestorMetrics(),
    getProgramMetrics(),
    getOperationsMetrics(),
    getContactMetrics(),
  ]);
  return { ventures, investor, programs, operations, contacts };
}