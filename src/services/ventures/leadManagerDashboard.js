/**
 * Lead Manager home dashboard (SERVICE layer).
 *
 * Builds the "My day" KPIs, the urgency queue and the enriched Mes Ventures
 * cards for staff whose active responsibility is `lead_manager`. Never invents
 * Super Admin power — the code list comes only from their own assignments.
 */

import {
  selectDeliverablesAwaitingReview,
  selectLastActivityByVentureCodes,
  selectLeadManagerVentures,
  selectMilestonesForLeadVentures,
  selectPendingJourneyReports,
  selectReviewQueueForLeadVentures,
  selectSessionIdsWithNotes,
  selectSessionsForLeadVentures,
  selectStagesForLeadVentures,
} from "@/models/leadManagerDashboard";

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 14;
const SOON_DAYS = 7;

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function dayIso(value) {
  if (!value) return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function statusOf(row) {
  return String(row?.status || "").trim().toLowerCase();
}

function isOpenMilestone(row) {
  const status = statusOf(row);
  return status && !["completed", "cancelled", "archived", "done"].includes(status);
}

function isBlockedMilestone(row) {
  return ["blocked"].includes(statusOf(row));
}

function isSignOffMilestone(row) {
  return ["under_review", "awaiting_signoff", "awaiting_signature", "pending_signoff"].includes(statusOf(row));
}

function isActiveStage(row) {
  return ["active", "in_progress", "open"].includes(statusOf(row));
}

function urgencyRank(kind) {
  const order = {
    overdue_milestone: 10,
    blocked_milestone: 20,
    review_stale: 30,
    review_deliverable: 35,
    review_submission: 40,
    due_soon_milestone: 50,
    journey_no_start: 60,
    journey_no_milestone: 70,
    inactive_venture: 80,
    session_no_memo: 90,
    session_upcoming: 100,
    journey_report_due: 110,
  };
  return order[kind] ?? 500;
}

/**
 * @param {string} staffCid
 * @returns {Promise<object>}
 */
export async function buildLeadManagerHome(staffCid) {
  if (!staffCid) {
    return emptyHome();
  }

  const venturesResult = await selectLeadManagerVentures(staffCid).catch(() => ({ rows: [] }));
  const ventures = venturesResult.rows || [];
  if (ventures.length === 0) {
    return emptyHome();
  }

  const codes = [...new Set(ventures.map((row) => String(row.venture_id)))];
  const dbIds = [...new Set(ventures.map((row) => String(row.venture_db_id)).filter(Boolean))];
  const byCode = new Map(ventures.map((row) => [String(row.venture_id), row]));
  const codeByDbId = new Map(ventures.map((row) => [String(row.venture_db_id), String(row.venture_id)]));

  const today = startOfUtcDay();
  const weekEnd = addDays(today, 7);
  const soonEnd = addDays(today, SOON_DAYS);
  const inactiveBefore = addDays(today, -INACTIVE_DAYS);

  const [
    milestonesResult,
    stagesResult,
    reviewResult,
    deliverablesResult,
    sessionsResult,
    activityResult,
    reportsResult,
  ] = await Promise.all([
    selectMilestonesForLeadVentures(dbIds).catch(() => ({ rows: [] })),
    selectStagesForLeadVentures(dbIds).catch(() => ({ rows: [] })),
    selectReviewQueueForLeadVentures(dbIds).catch(() => ({ rows: [] })),
    selectDeliverablesAwaitingReview(dbIds).catch(() => ({ rows: [] })),
    selectSessionsForLeadVentures({
      codes,
      fromIso: today.toISOString(),
      toIso: weekEnd.toISOString(),
    }).catch(() => ({ rows: [] })),
    selectLastActivityByVentureCodes(codes).catch(() => ({ rows: [] })),
    selectPendingJourneyReports(codes).catch(() => ({ rows: [] })),
  ]);

  const milestones = milestonesResult.rows || [];
  const stages = stagesResult.rows || [];
  const reviews = reviewResult.rows || [];
  const deliverables = deliverablesResult.rows || [];
  const sessions = sessionsResult.rows || [];
  const activityByCode = new Map(
    (activityResult.rows || []).map((row) => [String(row.venture_id), row.last_activity_at]),
  );
  const reports = reportsResult.rows || [];

  const sessionIds = sessions.map((row) => row.id).filter((id) => id != null);
  const notesResult = await selectSessionIdsWithNotes(sessionIds).catch(() => ({ rows: [] }));
  const sessionsWithNotes = new Set((notesResult.rows || []).map((row) => Number(row.session_id)));

  const milestonesByVentureDb = new Map();
  for (const milestone of milestones) {
    const key = String(milestone.venture_id);
    if (!milestonesByVentureDb.has(key)) milestonesByVentureDb.set(key, []);
    milestonesByVentureDb.get(key).push(milestone);
  }

  const stagesByVentureDb = new Map();
  for (const stage of stages) {
    const key = String(stage.venture_id);
    if (!stagesByVentureDb.has(key)) stagesByVentureDb.set(key, []);
    stagesByVentureDb.get(key).push(stage);
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const phaseBuckets = {};
  for (const venture of ventures) {
    const phase = String(venture.business_stage || venture.status || "unknown").trim() || "unknown";
    phaseBuckets[phase] = (phaseBuckets[phase] || 0) + 1;
  }

  const blockedMilestones = milestones.filter(isBlockedMilestone);
  const signOffMilestones = milestones.filter(isSignOffMilestone);
  const activeJourneys = stages.filter(isActiveStage);
  const sessionsToday = sessions.filter((row) => dayIso(row.start_time) === dayIso(today));
  const sessionsWeek = sessions;

  const kpis = {
    ventures_total: codes.length,
    ventures_by_phase: Object.entries(phaseBuckets).map(([phase, count]) => ({ phase, count })),
    active_journeys: activeJourneys.length,
    blocked_milestones: blockedMilestones.length,
    blocked_milestone_titles: blockedMilestones.slice(0, 8).map((row) => ({
      id: row.id,
      title: row.title,
      venture_id: codeByDbId.get(String(row.venture_id)) || null,
      venture_name: byCode.get(codeByDbId.get(String(row.venture_id)) || "")?.company_name
        || byCode.get(codeByDbId.get(String(row.venture_id)) || "")?.name
        || null,
    })),
    deliverables_to_review: deliverables.length + reviews.length,
    milestones_awaiting_signoff: signOffMilestones.length,
    sessions_today: sessionsToday.length,
    sessions_this_week: sessionsWeek.length,
    journey_reports_due: reports.length,
  };

  // ── Action queue ───────────────────────────────────────────────────────────
  const queue = [];

  for (const milestone of milestones) {
    if (!isOpenMilestone(milestone)) continue;
    const code = codeByDbId.get(String(milestone.venture_id));
    if (!code) continue;
    const venture = byCode.get(code);
    const target = dayIso(milestone.target_date);
    const base = {
      venture_id: code,
      venture_name: venture?.company_name || venture?.name || code,
      milestone_id: milestone.id,
      milestone_title: milestone.title,
      href: `/staff/ventures/${encodeURIComponent(code)}?tab=journey`,
    };
    if (isBlockedMilestone(milestone)) {
      queue.push({
        ...base,
        id: `blocked:${milestone.id}`,
        kind: "blocked_milestone",
        title: milestone.title,
        detail: milestone.title,
      });
    }
    if (target && target < dayIso(today)) {
      queue.push({
        ...base,
        id: `overdue:${milestone.id}`,
        kind: "overdue_milestone",
        title: milestone.title,
        detail: target,
      });
    } else if (target && target <= dayIso(soonEnd)) {
      queue.push({
        ...base,
        id: `soon:${milestone.id}`,
        kind: "due_soon_milestone",
        title: milestone.title,
        detail: target,
      });
    }
  }

  const staleBefore = addDays(today, -3).toISOString();
  for (const item of reviews) {
    const code = codeByDbId.get(String(item.task_venture_db_id));
    if (!code) continue;
    const venture = byCode.get(code);
    const created = item.created_at ? new Date(item.created_at).toISOString() : null;
    const kind = created && created < staleBefore ? "review_stale" : "review_submission";
    queue.push({
      id: `sub:${item.submission_id}`,
      kind,
      venture_id: code,
      venture_name: venture?.company_name || venture?.name || code,
      title: item.task_title || item.milestone_title || String(item.task_id),
      detail: item.submitted_by_name || null,
      href: `/staff/ventures/${encodeURIComponent(code)}?tab=overview`,
      created_at: item.created_at || null,
    });
  }

  for (const item of deliverables) {
    const code = codeByDbId.get(String(item.venture_id));
    if (!code) continue;
    const venture = byCode.get(code);
    queue.push({
      id: `del:${item.id}`,
      kind: "review_deliverable",
      venture_id: code,
      venture_name: venture?.company_name || venture?.name || code,
      title: item.title,
      detail: item.status || item.approval_status || null,
      href: `/staff/ventures/${encodeURIComponent(code)}?tab=journey`,
      created_at: item.updated_at || null,
    });
  }

  for (const stage of stages) {
    const code = codeByDbId.get(String(stage.venture_id));
    if (!code) continue;
    const venture = byCode.get(code);
    const stageMilestones = (milestonesByVentureDb.get(String(stage.venture_id)) || []).filter(
      (milestone) => String(milestone.journey_stage_id || "") === String(stage.id),
    );
    if (!stage.start_date && isActiveStage(stage)) {
      queue.push({
        id: `nostart:${stage.id}`,
        kind: "journey_no_start",
        venture_id: code,
        venture_name: venture?.company_name || venture?.name || code,
        title: stage.name,
        detail: null,
        href: `/staff/ventures/${encodeURIComponent(code)}?tab=journey`,
      });
    }
    if (stageMilestones.length === 0 && !["completed", "locked"].includes(statusOf(stage))) {
      queue.push({
        id: `nomilestone:${stage.id}`,
        kind: "journey_no_milestone",
        venture_id: code,
        venture_name: venture?.company_name || venture?.name || code,
        title: stage.name,
        detail: null,
        href: `/staff/ventures/${encodeURIComponent(code)}?tab=journey`,
      });
    }
  }

  for (const venture of ventures) {
    const code = String(venture.venture_id);
    const last = activityByCode.get(code) || venture.updated_at || null;
    if (last && new Date(last).getTime() < inactiveBefore.getTime()) {
      queue.push({
        id: `inactive:${code}`,
        kind: "inactive_venture",
        venture_id: code,
        venture_name: venture.company_name || venture.name || code,
        title: venture.company_name || venture.name || code,
        detail: last,
        href: `/staff/ventures/${encodeURIComponent(code)}`,
      });
    }
  }

  for (const session of sessions) {
    const code = String(session.venture_id);
    const venture = byCode.get(code);
    const hasMemo = sessionsWithNotes.has(Number(session.id));
    const startMs = new Date(session.start_time).getTime();
    const base = {
      venture_id: code,
      venture_name: venture?.company_name || venture?.name || code,
      title: session.title,
      detail: session.start_time || null,
      href: `/staff/ventures/${encodeURIComponent(code)}?tab=sessions`,
    };
    if (!hasMemo && Number.isFinite(startMs) && startMs < Date.now()) {
      queue.push({ id: `nomemo:${session.id}`, kind: "session_no_memo", ...base });
    } else if (dayIso(session.start_time) === dayIso(today)) {
      queue.push({ id: `session:${session.id}`, kind: "session_upcoming", ...base });
    }
  }

  for (const report of reports) {
    const code = String(report.venture_id);
    const venture = byCode.get(code);
    queue.push({
      id: `report:${report.id}`,
      kind: "journey_report_due",
      venture_id: code,
      venture_name: venture?.company_name || venture?.name || code,
      title: report.title || String(report.id),
      detail: report.status || null,
      href: `/staff/ventures/${encodeURIComponent(code)}?tab=plan`,
    });
  }

  queue.sort((a, b) => urgencyRank(a.kind) - urgencyRank(b.kind));

  // ── Enriched venture cards ─────────────────────────────────────────────────
  const cards = ventures.map((venture) => {
    const code = String(venture.venture_id);
    const dbId = String(venture.venture_db_id);
    const ventureMilestones = milestonesByVentureDb.get(dbId) || [];
    const open = ventureMilestones.filter(isOpenMilestone);
    const done = ventureMilestones.filter((row) => ["completed", "done"].includes(statusOf(row)));
    const blocked = ventureMilestones.filter(isBlockedMilestone);
    const nextDue = open
      .map((row) => ({ id: row.id, title: row.title, target_date: dayIso(row.target_date) }))
      .filter((row) => row.target_date)
      .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))[0] || null;

    return {
      venture_id: code,
      name: venture.company_name || venture.name || code,
      status: venture.status || null,
      business_stage: venture.business_stage || null,
      industry: venture.industry || null,
      country: venture.country || null,
      responsibility_code: venture.responsibility_code,
      scope_type: venture.scope_type,
      assigned_at: venture.assigned_at || null,
      milestones_total: ventureMilestones.length,
      milestones_done: done.length,
      milestones_blocked: blocked.length,
      next_deadline: nextDue,
      last_activity_at: activityByCode.get(code) || venture.updated_at || null,
      href: `/staff/ventures/${encodeURIComponent(code)}`,
    };
  });

  return {
    is_lead_manager: true,
    kpis,
    queue: queue.slice(0, 60),
    ventures: cards,
    generated_at: new Date().toISOString(),
  };
}

function emptyHome() {
  return {
    is_lead_manager: false,
    kpis: {
      ventures_total: 0,
      ventures_by_phase: [],
      active_journeys: 0,
      blocked_milestones: 0,
      blocked_milestone_titles: [],
      deliverables_to_review: 0,
      milestones_awaiting_signoff: 0,
      sessions_today: 0,
      sessions_this_week: 0,
      journey_reports_due: 0,
    },
    queue: [],
    ventures: [],
    generated_at: new Date().toISOString(),
  };
}
