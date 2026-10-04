/**
 * Dashboard service — the overview aggregation assembly.
 *
 * The work behind `GET /api/dashboard`: the IDOR-safe scope resolution, the
 * parallel read bundle, then the calendar, the summary / attention / quick-access
 * shaping. Answers `{ status, body }`; the controller keeps `initDb`, the
 * authentication and the response envelope.
 *
 * Every independent read runs in parallel via `Promise.allSettled`, so one
 * failing widget never takes the dashboard down — each result is checked for
 * `fulfilled` before use, exactly as before.
 *
 * Every statement lives in `@/models/dashboard` (and `@/models/workspace` for the
 * venture sessions). No SQL, no HTTP.
 */

import {
  getUserIdentity,
  getCalendarTasks,
  getCalendarPrograms,
  getCalendarSessions,
  getCalendarDeliverables,
  getCalendarEvents,
  getTopLevelTasks,
  getActiveBlockers,
  getVisiblePrograms,
  getOwnedProjectsWithStats,
  getCollabProjectIds,
  getCollabProjectsByIds,
  getRecentActivity,
  getAssignedTasks,
  getQuickAccessTasks,
  getKpiProgressRows,
} from "@/models/dashboard";
import { getCalendarVentureSessions } from "@/services/workspace/calendar";
import { buildOverviewCalendar } from "./calendar";
import { summarizeTaskStats, summarizeBlockers } from "./attention";
import { buildQuickAccessProjects } from "./projects";

/**
 * Build one person's dashboard.
 *
 * @returns {Promise<{status:number, body:object}>} the response the controller
 *          returns as-is.
 */
export async function buildDashboardOverview({ session, requestedUserId, requestedRole, year, month }) {
  // SECURITY PATCH: Prevent IDOR by enforcing session identity.
  // Only super_admin or admin may view another user's dashboard.
  const isSessionAdmin = session.role === "super_admin" || session.role === "admin";
  const userId = isSessionAdmin && requestedUserId ? requestedUserId : session.cid;
  const role = isSessionAdmin && requestedRole ? requestedRole : session.role;

  if (!userId) {
    return { status: 400, body: { success: false, error: "user_id is required" } };
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // ── PHASE 1: All independent queries in parallel ──
  const [
    userResult,
    taskDatesResult,
    programDatesResult,
    sessionsResult,
    deliverablesResult,
    eventsResult,
    taskStatsResult,
    blockersResult,
    programCountResult,
    ownedProjectsResult,
    collabMembersResult,
    activityResult,
    assignmentsResult,
    myTasksResult,
    kpiProgressResult,
    ventureSessionsResult,
  ] = await Promise.allSettled([
    getUserIdentity(userId),
    getCalendarTasks(userId),
    getCalendarPrograms(userId, role),
    getCalendarSessions(userId, role),
    getCalendarDeliverables(userId, role),
    getCalendarEvents(userId),
    // Task stats (summary + overdue + due today). Only top-level tasks count as
    // tasks — subtasks are tracked via their parent.
    getTopLevelTasks(userId),
    getActiveBlockers(userId),
    getVisiblePrograms(userId, role),
    getOwnedProjectsWithStats(userId, role),
    getCollabProjectIds(userId),
    getRecentActivity(userId),
    getAssignedTasks(userId),
    getQuickAccessTasks(userId),
    getKpiProgressRows(userId),
    // Venture sessions (calendar) — coach's own + venture-facing
    getCalendarVentureSessions(userId),
  ]);

  // ── PHASE 2: Process results ──

  let userName = "User";
  if (userResult.status === "fulfilled" && userResult.value.rows.length > 0) {
    userName = userResult.value.rows[0].name || "User";
  }

  const calendarEvents = buildOverviewCalendar({
    taskDates: taskDatesResult.status === "fulfilled" ? taskDatesResult.value.rows : [],
    programs: programDatesResult.status === "fulfilled" ? programDatesResult.value.rows : [],
    sessions: sessionsResult.status === "fulfilled" ? sessionsResult.value.rows : [],
    ventureSessions:
      ventureSessionsResult.status === "fulfilled" ? ventureSessionsResult.value.rows || [] : [],
    deliverables:
      deliverablesResult.status === "fulfilled" ? deliverablesResult.value.rows : [],
    events: eventsResult.status === "fulfilled" ? eventsResult.value.rows : [],
    todayStr,
  });

  // Filter calendar to requested month
  const monthStr = String(month).padStart(2, "0");
  const monthEvents = calendarEvents.filter(
    (event) => event.date && event.date.startsWith(`${year}-${monthStr}`),
  );

  // Task stats
  const { totalTasks, openTasks, overdueTasks, overdueTaskList, dueTodayList } =
    taskStatsResult.status === "fulfilled"
      ? summarizeTaskStats(taskStatsResult.value.rows, todayStr)
      : summarizeTaskStats([], todayStr);

  // Blocker stats
  const { activeBlockers, criticalBlockers, criticalBlockerList, allBlockers } =
    blockersResult.status === "fulfilled"
      ? summarizeBlockers(blockersResult.value.rows)
      : summarizeBlockers([]);

  // Programs
  let programCount = 0;
  const userPrograms = [];
  if (programCountResult.status === "fulfilled") {
    programCount = programCountResult.value.rows.length;
    userPrograms.push(...programCountResult.value.rows.slice(0, 5));
  }

  // Projects (owned + collaborator)
  let projectCount = 0;
  const userProjects = [];

  if (
    ownedProjectsResult.status === "fulfilled" &&
    collabMembersResult.status === "fulfilled"
  ) {
    let collaboratorProjects = null;
    const collabProjectIds = collabMembersResult.value.rows.map((row) => row.project_id);
    if (collabProjectIds.length > 0) {
      try {
        const collabProjectsResult = await getCollabProjectsByIds(collabProjectIds);
        collaboratorProjects = collabProjectsResult.rows || [];
      } catch (_) {}
    }

    userProjects.push(
      ...buildQuickAccessProjects(ownedProjectsResult.value.rows || [], collaboratorProjects),
    );
    projectCount = userProjects.length;
  }

  // Activity
  let activity = [];
  if (activityResult.status === "fulfilled") {
    activity = activityResult.value.rows;
  }

  // Assignments
  let assignments = [];
  if (assignmentsResult.status === "fulfilled") {
    assignments = assignmentsResult.value.rows;
  }

  // My tasks
  let myTasks = [];
  if (myTasksResult.status === "fulfilled") {
    myTasks = myTasksResult.value.rows;
  }

  // KPI Progress
  let kpiProgress = [];
  if (kpiProgressResult.status === "fulfilled") {
    kpiProgress = kpiProgressResult.value.rows;
  }

  return {
    status: 200,
    body: {
      success: true,
      user: { cid: userId, name: userName, role },
      calendar: {
        events: monthEvents,
        total: monthEvents.length,
        month,
        year,
      },
      summary: {
        programs: programCount,
        projects: projectCount,
        tasks: { total: totalTasks, open: openTasks },
        blockers: { active: activeBlockers, critical: criticalBlockers },
        overdueTasks,
        criticalBlockers,
      },
      attention: {
        overdueTasks: overdueTaskList.slice(0, 10),
        criticalBlockers: criticalBlockerList.slice(0, 10),
        dueToday: dueTodayList.slice(0, 10),
      },
      activity: activity.map((activityEntry) => ({
        action: activityEntry.action,
        description: activityEntry.description,
        timestamp: activityEntry.timestamp,
        user_id: activityEntry.user_id,
      })),
      quickAccess: {
        programs: userPrograms,
        projects: userProjects,
        tasks: myTasks,
        blockers: allBlockers.slice(0, 5),
      },
      assignments,
      kpis: kpiProgress,
    },
  };
}