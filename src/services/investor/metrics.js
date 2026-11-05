import {
  countActivityByType,
  selectConversionPairs,
  countProfiles,
  countProfilesByVisibilityMode,
  countProfilesBySource,
  countActiveInvestors,
  getInvitationStats,
  getDealFlowStats,
  getDealFlowAge,
  getDealFlowOutcomes,
  getDeckReadiness,
  getEngagementStats,
  getIntroStats,
  getDeclineReasons,
  getPipelineByStage,
  getPipelineTotals,
  getMeetingStats,
  getInvestmentStats,
  getFinancingStats,
  getStageTransitions,
  getInterestPairs,
  getTimeToClose,
  getIntroMeetingTimings,
  getRescheduleStats,
  getLossReasons,
  getIntroToDiligence,
} from "@/models/investor/metrics";

const count = (rows, type) => Number((rows || []).find((row) => row.event_type === type)?.count || 0);
const num = (value) => (value == null ? null : Number(value));
const rate = (a, b) => (Number(b) > 0 ? Number(a) / Number(b) : null);
const first = (result) => result?.rows?.[0] || {};

const FUNNEL = ["interested", "watching", "meeting_requested", "due_diligence", "negotiation", "invested"];

function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * E2/E3 — from `pipeline_stage_changed` events, per investor-venture pair:
 * which stages were reached, the step conversion between consecutive stages,
 * and the median days spent in each stage.
 */
function computeStageMetrics(rows) {
  const pairs = new Map();
  for (const row of rows || []) {
    const key = `${row.investor_id}:${row.venture_id}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push({ stage: row.stage, at: new Date(row.first_at).getTime() });
  }

  const reached = {};
  const durations = {};

  for (const stages of pairs.values()) {
    stages.sort((a, b) => a.at - b.at);
    const reachedSet = new Set(stages.map((entry) => entry.stage));
    for (const stage of FUNNEL) {
      if (reachedSet.has(stage)) reached[stage] = (reached[stage] || 0) + 1;
    }
    for (let index = 0; index < stages.length - 1; index += 1) {
      const days = (stages[index + 1].at - stages[index].at) / 86400000;
      if (days >= 0) {
        const stage = stages[index].stage;
        if (!durations[stage]) durations[stage] = [];
        durations[stage].push(days);
      }
    }
  }

  const stepConversion = {};
  for (let index = 0; index < FUNNEL.length - 1; index += 1) {
    const from = FUNNEL[index];
    const to = FUNNEL[index + 1];
    stepConversion[`${from}->${to}`] = rate(reached[to] || 0, reached[from] || 0);
  }

  const timeInStage = FUNNEL.map((stage) => ({
    stage,
    medianDays: median(durations[stage]),
    pairs: (durations[stage] || []).length,
  }));

  return { reached, stepConversion, timeInStage };
}

/**
 * Phase 8 — the A–F metrics, derived live from the event log and the tables.
 * Missing data is null, never zero. C4 is removed. F5–F7 live on the Studio
 * Portfolio. E2/E3 use the stage history the log records.
 */
export async function getInvestorMetrics({ from = null, to = null } = {}) {
  const [
    activity,
    conversion,
    profiles,
    byMode,
    bySource,
    active,
    invitations,
    dealFlow,
    dealAge,
    dealOutcomes,
    decks,
    engagement,
    intros,
    declines,
    pipeline,
    pipelineTotals,
    meetings,
    investments,
    financing,
    stageRows,
    interestPairs,
    timeToClose,
    introMeeting,
    reschedule,
    losses,
    introToDiligence,
  ] = await Promise.all([
    countActivityByType({ from, to }),
    selectConversionPairs(),
    countProfiles(),
    countProfilesByVisibilityMode(),
    countProfilesBySource(),
    countActiveInvestors(30),
    getInvitationStats(),
    getDealFlowStats(),
    getDealFlowAge(),
    getDealFlowOutcomes(),
    getDeckReadiness(),
    getEngagementStats(),
    getIntroStats(),
    getDeclineReasons(),
    getPipelineByStage(),
    getPipelineTotals(),
    getMeetingStats(),
    getInvestmentStats(),
    getFinancingStats(),
    getStageTransitions(),
    getInterestPairs(),
    getTimeToClose(),
    getIntroMeetingTimings(),
    getRescheduleStats(),
    getLossReasons(),
    getIntroToDiligence(),
  ]);

  const ev = activity.rows || [];
  const conv = first(conversion);
  const prof = first(profiles);
  const inv = first(invitations);
  const df = first(dealFlow);
  const age = first(dealAge);
  const deck = first(decks);
  const eng = first(engagement);
  const intro = first(intros);
  const meet = first(meetings);
  const invest = first(investments);
  const fin = first(financing);
  const pt = first(pipelineTotals);
  const activeCount = Number(first(active).count || 0);
  const close = first(timeToClose);
  const timings = first(introMeeting);
  const resched = first(reschedule);
  const diligence = first(introToDiligence);

  const stage = computeStageMetrics(stageRows.rows || []);

  const submitted = count(ev, "application_submitted");
  const approvedEv = count(ev, "application_approved");
  const rejectedEv = count(ev, "application_rejected");
  const activatedEv = count(ev, "account_activated");

  return {
    period: { from, to },
    A: {
      applicationsReceived: submitted,
      approvalRate: rate(approvedEv, approvedEv + rejectedEv),
      medianDaysToApprove: num(conv.median_days_to_approve),
      activationRate: rate(activatedEv, approvedEv),
      medianDaysToActivate: num(conv.median_days_to_activate),
      activeInvestors: activeCount,
      activeShare: rate(activeCount, Number(prof.approved || 0)),
      byVisibilityMode: byMode.rows || [],
      invitationSent: Number(inv.sent || 0),
      invitationOpened: Number(inv.opened || 0),
      invitationSubmitted: Number(inv.submitted || 0),
      invitationSubmitRate: rate(Number(inv.submitted || 0), Number(inv.sent || 0)),
      sourceMix: bySource.rows || [],
      totalProfiles: Number(prof.total || 0),
      approvedProfiles: Number(prof.approved || 0),
    },
    B: {
      liveEntries: Number(df.live_count || 0),
      liveTargetTotal: num(df.live_target_total),
      totalEntries: Number(df.total_entries || 0),
      closedEntries: Number(df.closed_entries || 0),
      raisedEntries: Number(df.raised_entries || 0),
      medianDaysInDealFlow: num(age.median_days),
      outcomes: dealOutcomes.rows || [],
      deckReadiness: rate(Number(deck.with_published_deck || 0), Number(deck.entries || 0)),
      raiseSuccessRate: rate(Number(df.raised_entries || 0), Number(df.closed_entries || 0)),
    },
    C: {
      ventureViews: Number(eng.venture_views || 0),
      uniqueViewers: Number(eng.unique_viewers || 0),
      exposure: rate(Number(eng.unique_viewers || 0), Number(prof.approved || 0)),
      deckOpenRate: rate(Number(eng.unique_deck_openers || 0), Number(eng.unique_viewers || 0)),
      interestRate: rate(Number(eng.interests || 0), Number(eng.venture_views || 0)),
      watchlistAdds: Number(eng.watchlist_adds || 0),
      compares: Number(eng.compares || 0),
    },
    D: {
      introRequests: Number(intro.requested || 0),
      introApprovalRate: rate(
        Number(intro.approved || 0),
        Number(intro.approved || 0) + Number(intro.declined || 0),
      ),
      medianHoursToDecide: num(intro.median_hours_to_decide),
      medianHoursToSchedule: num(timings.median_hours_approved_to_meeting),
      medianDaysRequestToMeeting: num(timings.median_days_request_to_meeting),
      meetingsHeld: Number(meet.held || 0),
      noShowRate: rate(
        Number(meet.no_show || 0),
        Number(meet.held || 0) + Number(meet.no_show || 0),
      ),
      rescheduleRate: rate(Number(resched.rescheduled || 0), Number(resched.confirmed || 0)),
      declineReasons: declines.rows || [],
      introToDiligenceRate: rate(Number(diligence.reached || 0), Number(diligence.approved || 0)),
      introBacklog: Number(intro.backlog || 0),
    },
    E: {
      pipelineByStage: pipeline.rows || [],
      pairs: Number(pt.pairs || 0),
      investedPairs: Number(pt.invested || 0),
      interestToInvestment: rate(
        Number(pt.invested || 0),
        Number(interestPairs.rows?.[0]?.count || 0) || Number(pt.pairs || 0),
      ),
      stepConversion: stage.stepConversion,
      timeInStage: stage.timeInStage,
      medianDaysToClose: num(close.median_days),
      timeToClosePairs: Number(close.pairs || 0),
      investments: Number(invest.count || 0),
      investedTotal: num(invest.total),
      averageTicket: rate(Number(invest.total || 0), Number(invest.count || 0)),
      lossReasons: losses.rows || [],
    },
    F: {
      financingEvents: Number(fin.count || 0),
      outsideCapital: num(fin.total),
      note: "F2–F7 are reported by the Studio Portfolio (Ventures reporting), not duplicated here.",
    },
  };
}
