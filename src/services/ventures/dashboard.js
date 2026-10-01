/**
 * services/ventures/dashboard — the Venture dashboard aggregate.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/dashboard/route.js` (lane
 * L2). Each widget section loads independently — if one fails, it answers
 * null (or its empty shape) and the others still return. Audience rules stay
 * here with the data they filter: internal viewers (global Venture authority)
 * get the internal audit stream and the internal 'sa' feed; everyone else only
 * ever receives Venture-facing events. The controller keeps the scoped access
 * gate, decides `isInternalViewer` from the session, and shapes the response.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import {
  getOrCreateStartupProfile,
  getOrCreateVerification,
} from "@/lib/ventures";
import { listVentureMembers, summarizeVentureMembers } from "@/models/ventureMembers";
import {
  getVentureByCode,
  getVentureDashboardInfo,
  listVentureMemberRecipients,
  selectInternalNotificationFeed,
  selectVentureNotificationFeed,
  listVentureActivityLog,
  listVentureDocumentsForDashboard,
  listVentureDocumentsForDashboardLegacy,
  listVentureMeetings,
  listVentureKpiSummary,
  countVentureAdvisors,
  countVentureCoachingSessions,
  countVentureActiveCoachAssignments,
} from "@/models/ventureWorkspace";

/**
 * @param {object} args
 * @param {string} args.ventureParam      the route's venture id (code or UUID)
 * @param {boolean} args.isInternalViewer global Venture authority (super_admin)
 * @returns {Promise<object>} the `dashboard` object of the response
 */
export async function buildVentureDashboard({ ventureParam, isInternalViewer }) {
  const id = ventureParam;
  // Resolve the internal id (UUID-lineage tables key on it, not the VNT code)
  let dbId = id;
  try {
    const ventureLookup = await getVentureByCode(id);
    if (ventureLookup.rows[0]) dbId = ventureLookup.rows[0].id;
  } catch (_) {}

  // ── Profile Completion ──
  const profileCompletion = (async () => {
    try {
      const data = await getOrCreateStartupProfile(id);
      const items = [
        { step: 1, name: "Startup Identity", completed: !!data.profile?.step_1_data?.startup_name },
        { step: 2, name: "Business Information", completed: !!data.profile?.step_2_data?.legal_structure },
        { step: 3, name: "Founder Information", completed: Array.isArray(data.profile?.step_3_data?.founders) && data.profile.step_3_data.founders.length > 0 },
        { step: 4, name: "Team Information", completed: !!data.profile?.step_4_data?.team_size },
        { step: 5, name: "Supporting Documents", completed: data.documents?.length > 0 },
        { step: 6, name: "Review & Submit", completed: data.profile?.is_submitted },
      ];
      return {
        percentage: data.completion_percentage || 0,
        is_submitted: data.profile?.is_submitted || false,
        items,
        missing: items.filter((item) => !item.completed).map((item) => item.name),
      };
    } catch { return null; }
  })();

  // ── Venture Info ──
  const ventureInfo = (async () => {
    try {
      const ventureQuery = await getVentureDashboardInfo(id);
      return ventureQuery.rows[0] || null;
    } catch { return null; }
  })();

  // ── Members / Team ──
  // ONE list, ONE set of counts: the membership rows are the Venture's people,
  // founder included. The founder invitation ledger is deliberately NOT read
  // here — it holds invitations, so counting it made a Venture that visibly
  // had a founder report "Team 0" and "no team members yet".
  const teamData = (async () => {
    try {
      const members = await listVentureMembers(id);
      const summary = summarizeVentureMembers(members);
      return {
        total: summary.total,
        active: summary.active,
        founders: summary.founders,
        team: summary.team,
        suspended: summary.suspended,
        owner: summary.owner
          ? { name: summary.owner.name, email: summary.owner.email, role: summary.owner.role }
          : null,
        members: members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          role: member.role,
          is_founder: member.is_founder,
          is_owner: member.is_owner,
          status: member.status,
          joined_at: member.joined_at,
        })),
      };
    } catch { return null; }
  })();

  // ── Notifications ──
  // Venture members see events addressed to the Venture's members ONLY.
  // Internal viewers additionally see the internal 'sa' staff stream
  // (that feed is NEVER exposed to Venture members).
  const notifications = (async () => {
    try {
      const memberResult = await listVentureMemberRecipients(id);
      const recipientIds = [...new Set((memberResult.rows || []).flatMap((row) => [row.contact_id, row.user_cid]).filter(Boolean))];
      let feedResult;
      if (recipientIds.length > 0) {
        feedResult = await selectVentureNotificationFeed({ recipientIds, includeInternal: isInternalViewer });
      } else if (isInternalViewer) {
        feedResult = await selectInternalNotificationFeed();
      } else {
        return { unread: 0, recent: [] };
      }
      const notificationRows = feedResult.rows || [];
      return {
        unread: notificationRows.filter((notification) => !notification.is_read).length,
        recent: notificationRows.slice(0, 5).map((notification) => ({
          id: notification.id, title: notification.title, message: notification.message, type: notification.type,
          is_read: !!notification.is_read, created_at: notification.created_at,
        })),
      };
    } catch { return null; }
  })();

  // ── Recent Activity ──
  // The raw venture_activity_log is an INTERNAL audit stream (staff actors,
  // internal reviews, assignments).
  //   • Internal viewers (global Venture authority) keep the full audit rows.
  //   • Venture members get a strict allowlist of Venture-facing events as an
  //     event `action` code (no actor identity) which the UI translates.
  // Everything else stays internal (admin/audit surfaces).
  const VENTURE_FACING_CODES = [
    "VENTURE_CREATED",
    "VENTURE_APPROVED",
    "VENTURE_REGISTERED",
    "VENTURE_UPDATED",
    "PROFILE_SUBMITTED",
    "MILESTONE_COMPLETED",
    "DELIVERABLE_SUBMITTED",
    "OPERATING_PLAN_TEMPLATE_APPLIED",
    "SESSION_SCHEDULED",
    "COACHING_SCHEDULED",
    "COACHING_APPROVED",
  ];
  const recentActivity = (async () => {
    try {
      const activityQuery = await listVentureActivityLog(id);
      const rows = activityQuery.rows || [];
      if (isInternalViewer) {
        return rows.slice(0, 10).map((entry) => ({
          id: entry.id, action: entry.action, actor: entry.actor_name || "System",
          details: entry.details, created_at: entry.created_at,
        }));
      }
      return rows
        .filter((entry) => VENTURE_FACING_CODES.includes(entry.action))
        .slice(0, 10)
        .map((entry) => ({ id: entry.id, action: entry.action, created_at: entry.created_at }));
    } catch { return null; }
  })();

  // ── Verification Status ──
  const verification = (async () => {
    try {
      const verificationData = await getOrCreateVerification(id);
      const items = verificationData.items.map((item) => ({
        category: item.category,
        label: item.category_label,
        status: item.status,
      }));
      return {
        status: verificationData.verification.status,
        categories: items,
        verified_count: items.filter((item) => item.status === "verified").length,
        total_count: items.length,
      };
    } catch { return null; }
  })();

  // ── Documents (the real data room) ──
  const documents = (async () => {
    try {
      let rows = [];
      try {
        const documentsQuery = await listVentureDocumentsForDashboard(id);
        rows = documentsQuery.rows || [];
      } catch (_) {
        const documentsQuery = await listVentureDocumentsForDashboardLegacy(id);
        rows = documentsQuery.rows || [];
      }
      return {
        total: rows.length,
        recent: rows,
      };
    } catch { return null; }
  })();

  // ── Meetings (placeholder — integrates with calendar/events module) ──
  const meetings = (async () => {
    try {
      const meetingsQuery = await listVentureMeetings(id).catch(() => ({ rows: [] }));
      return (meetingsQuery.rows || []).map((meeting) => ({
        id: meeting.id, title: meeting.title, description: meeting.description,
        date: meeting.event_date, time: meeting.event_time, status: meeting.status, type: meeting.type || "meeting",
      }));
    } catch { return []; }
  })();

  // ── KPI Summary (the venture KPI module, not the global kpis table) ──
  const kpiSummary = (async () => {
    try {
      const kpiQuery = await listVentureKpiSummary(dbId).catch(() => ({ rows: [] }));
      return (kpiQuery.rows || []).map((kpi) => ({
        id: kpi.id, title: kpi.name, category: kpi.auto_calc_source || "manual",
        current: kpi.current_value, target: kpi.target_value,
        unit: kpi.unit, status: kpi.auto_calc_source ? "auto" : "manual",
        progress: kpi.target_value > 0 ? Math.round((kpi.current_value / kpi.target_value) * 100) : 0,
      }));
    } catch { return []; }
  })();

  // ── Coaching / Advisors (real sources) ──
  const coaching = (async () => {
    try {
      const [advisorResult, sessionResult, assignmentResult] = await Promise.all([
        countVentureAdvisors(dbId).catch(() => ({ rows: [{ n: 0 }] })),
        countVentureCoachingSessions(dbId).catch(() => ({ rows: [{ n: 0 }] })),
        countVentureActiveCoachAssignments(dbId).catch(() => ({ rows: [{ n: 0 }] })),
      ]);
      const coaches = Number(assignmentResult.rows?.[0]?.n || 0);
      const advisors = Number(advisorResult.rows?.[0]?.n || 0);
      const sessions = Number(sessionResult.rows?.[0]?.n || 0);
      return { coaches, advisors, coaching_sessions: sessions, total: coaches + advisors };
    } catch { return { coaches: [], advisors: [], coaching_sessions: 0, total: 0 }; }
  })();

  // ── Investment Readiness (calculated from profile completeness + stage) ──
  const investmentReadiness = (async () => {
    try {
      const [venture, profile] = await Promise.all([ventureInfo, profileCompletion]);
      const stage = venture?.business_stage || "idea";
      const stageScores = { idea: 10, validation: 25, early_traction: 45, growth: 65, scaling: 85 };
      const stageScore = stageScores[stage] || 10;
      const profileScore = profile?.percentage || 0;
      const score = Math.min(Math.round((stageScore * 0.4) + (profileScore * 0.6)), 100);
      const nextMilestones = [];
      if (!profile?.is_submitted) nextMilestones.push("Complete Startup Profile");
      if (!profile?.items?.[4]?.completed) nextMilestones.push("Upload Supporting Documents");
      return { score, stage, stage_weight: stageScore, profile_weight: profileScore, next_milestones: nextMilestones };
    } catch { return { score: 0, stage: "unknown", next_milestones: [] }; }
  })();

  // ── Wait for all (with individual error handling) ──
  const [
    profileResult,
    ventureResult,
    teamResult,
    notificationsResult,
    activityResult,
    verificationResult,
    documentsResult,
    meetingsResult,
    kpiSummaryResult,
    coachingResult,
    investmentResult,
  ] = await Promise.all([
    profileCompletion, ventureInfo, teamData, notifications,
    recentActivity, verification, documents, meetings, kpiSummary, coaching, investmentReadiness,
  ]);

  return {
    profile_completion: profileResult,
    venture: ventureResult,
    team: teamResult,
    notifications: notificationsResult,
    recent_activity: activityResult,
    verification: verificationResult,
    documents: documentsResult,
    meetings: meetingsResult,
    kpis: kpiSummaryResult,
    coaching: coachingResult,
    investment_readiness: investmentResult,
  };
}
