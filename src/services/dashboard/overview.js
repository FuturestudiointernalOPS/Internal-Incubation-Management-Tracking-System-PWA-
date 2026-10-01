/**
 * Dashboard — the overview aggregation (SERVICE layer).
 *
 * The work behind `GET /api/dashboard`: the IDOR-safe scope resolution, the
 * parallel read bundle, the calendar assembly (tasks, programs, sessions,
 * venture sessions, deliverables, events), and the summary / attention /
 * quick-access shaping.
 *
 * HTTP-free: it reads through `@/models/dashboard` and `@/models/workspace` and
 * answers `{ status, body }`. The controller keeps `initDb`, the authentication
 * and the response envelope.
 *
 * Every independent read runs in parallel via `Promise.allSettled`, so one
 * failing widget never takes the dashboard down — each result is checked for
 * `fulfilled` before use, exactly as before.
 */

import {
  getProgramKpiSummary,
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
import { getCalendarVentureSessions } from "@/models/workspace";

/** Super Admin dashboard shortcut: the program KPI summary rows. */
export async function getDashboardKpiSummary() {
  const kpiSummaryResult = await getProgramKpiSummary();
  return kpiSummaryResult.rows;
}

/** Convert any date format (Date object, ISO string, …) to YYYY-MM-DD. */
function toDateStr(value) {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/** All dates from start to end (inclusive). */
function dateRange(start, end) {
  const dates = [];
  const startDate = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return dates;
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  return dates;
}

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

  const calendarEvents = [];

  // Tasks → calendar — span all days from start_date to end_date
  if (taskDatesResult.status === "fulfilled") {
    for (const task of taskDatesResult.value.rows) {
      const startStr = toDateStr(task.start_date);
      const endStr = toDateStr(task.end_date);
      // If no dates at all, show on today
      if (!startStr && !endStr) {
        calendarEvents.push({
          id: `task-${task.id}-${todayStr}`,
          title: task.title,
          date: todayStr,
          type: "task_active",
          source: "task",
          status: task.status,
          priority: task.priority,
          related_id: task.id,
          project_id: task.project_id,
        });
        continue;
      }
      // Determine the effective date range
      const rangeStart = startStr || endStr;
      const rangeEnd = endStr || startStr;
      const days = dateRange(rangeStart, rangeEnd);
      for (const day of days) {
        const isFirst = day === rangeStart;
        const isLast = day === rangeEnd;
        calendarEvents.push({
          id: `task-${task.id}-${day}`,
          title: task.title,
          date: day,
          type: isFirst ? "task_start" : isLast ? "task_due" : "task_active",
          source: "task",
          status: task.status,
          priority: task.priority,
          related_id: task.id,
          project_id: task.project_id,
        });
      }
    }
  }

  // Programs → calendar
  if (programDatesResult.status === "fulfilled") {
    for (const program of programDatesResult.value.rows) {
      if (program.start_date) {
        const startDateStr = toDateStr(program.start_date);
        if (startDateStr)
          calendarEvents.push({
            id: `program-${program.id}-start`,
            title: `${program.name} starts`,
            date: startDateStr,
            type: "program_start",
            source: "program",
            status: "active",
            related_id: program.id,
          });
      }
      if (program.end_date) {
        const endDateStr = toDateStr(program.end_date);
        if (endDateStr)
          calendarEvents.push({
            id: `program-${program.id}-end`,
            title: `${program.name} ends`,
            date: endDateStr,
            type: "program_end",
            source: "program",
            status: "active",
            related_id: program.id,
          });
      }
    }
  }

  // Sessions → calendar
  if (sessionsResult.status === "fulfilled") {
    for (const sessionRow of sessionsResult.value.rows) {
      calendarEvents.push({
        id: `session-${sessionRow.id}`,
        title: sessionRow.title,
        date: toDateStr(sessionRow.start_at),
        type: "session",
        source: "session",
        status: "scheduled",
        related_id: sessionRow.id,
        project_id: sessionRow.program_id,
      });
    }
  }

  // Venture sessions: the coach's own sessions plus the venture-facing sessions
  // of the Ventures this person is part of.
  if (ventureSessionsResult.status === "fulfilled") {
    for (const sessionRow of ventureSessionsResult.value.rows || []) {
      calendarEvents.push({
        id: `vsess-${sessionRow.id}`,
        title: sessionRow.title,
        date: toDateStr(sessionRow.start_time),
        type: "venture_session",
        // "session" keeps the existing session colour/icon in the calendar UI;
        // the type still says exactly what it is.
        source: "session",
        status: sessionRow.status || "scheduled",
        related_id: sessionRow.id,
        project_id: null,
        description: sessionRow.coach_name ? `Coach: ${sessionRow.coach_name}` : null,
        milestone_ref: sessionRow.milestone_ref || null,
      });
    }
  }

  // Deliverables → calendar
  if (deliverablesResult.status === "fulfilled") {
    for (const deliverable of deliverablesResult.value.rows) {
      calendarEvents.push({
        id: `deliverable-${deliverable.id}`,
        title: `${deliverable.title} due`,
        date: toDateStr(deliverable.due_date),
        type: "deliverable_due",
        source: "deliverable",
        status: "pending",
        related_id: deliverable.id,
      });
    }
  }

  // v2_events → calendar
  if (eventsResult.status === "fulfilled") {
    for (const calendarEvent of eventsResult.value.rows) {
      calendarEvents.push({
        id: `v2event-${calendarEvent.id}`,
        title: calendarEvent.title,
        date: toDateStr(calendarEvent.start_time),
        type: "event",
        source: "event",
        status: "scheduled",
        related_id: calendarEvent.id,
      });
    }
  }

  // Filter calendar to requested month
  const monthStr = String(month).padStart(2, "0");
  const monthEvents = calendarEvents.filter(
    (event) => event.date && event.date.startsWith(`${year}-${monthStr}`),
  );

  // Task stats
  let totalTasks = 0,
    openTasks = 0,
    overdueTasks = 0;
  const overdueTaskList = [],
    dueTodayList = [];

  if (taskStatsResult.status === "fulfilled") {
    totalTasks = taskStatsResult.value.rows.length;
    for (const task of taskStatsResult.value.rows) {
      if (task.status !== "completed") openTasks++;
      if (
        task.end_date &&
        task.status !== "completed" &&
        String(task.end_date).split("T")[0] < todayStr
      ) {
        overdueTasks++;
        overdueTaskList.push({
          id: task.id,
          title: task.title,
          due_date: task.end_date,
          priority: task.priority,
          project_id: task.project_id,
        });
      }
      if (
        task.end_date &&
        task.status !== "completed" &&
        String(task.end_date).split("T")[0] === todayStr
      ) {
        dueTodayList.push({
          id: task.id,
          title: task.title,
          type: "task",
          related_id: task.id,
          project_id: task.project_id,
        });
      }
    }
  }

  // Blocker stats
  let activeBlockers = 0,
    criticalBlockers = 0;
  const criticalBlockerList = [];
  const allBlockers = [];

  if (blockersResult.status === "fulfilled") {
    activeBlockers = blockersResult.value.rows.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const blocker of blockersResult.value.rows) {
      if (blocker.severity === "critical" || blocker.severity === "high") {
        let includeBlocker = true;
        if (blocker.end_date) {
          const dueDate = new Date(blocker.end_date);
          dueDate.setHours(0, 0, 0, 0);
          includeBlocker = dueDate <= today;
        }
        if (includeBlocker) {
          criticalBlockers++;
          criticalBlockerList.push({
            id: blocker.id,
            title: blocker.title,
            severity: blocker.severity,
            task_id: blocker.task_id,
            task_title: blocker.task_title,
            project_id: blocker.project_id,
          });
        }
      }
      allBlockers.push(blocker);
    }
  }

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
  let collabProjects = [];

  if (
    ownedProjectsResult.status === "fulfilled" &&
    collabMembersResult.status === "fulfilled"
  ) {
    const ownedMapped = (ownedProjectsResult.value.rows || []).map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      owner_id: project.owner_id,
      meta: project.meta,
      role: "owner",
      taskStats: {
        total: parseInt(project.task_total) || 0,
        completed: parseInt(project.task_completed) || 0,
      },
      blockerStats: { active: parseInt(project.blocker_active) || 0 },
      completionRate:
        (parseInt(project.task_total) || 0) > 0
          ? Math.round(
              ((parseInt(project.task_completed) || 0) / (parseInt(project.task_total) || 1)) * 100,
            )
          : 0,
    }));

    // Collaborator projects
    const collabProjectIds = collabMembersResult.value.rows.map((row) => row.project_id);
    if (collabProjectIds.length > 0) {
      try {
        const collabProjectsResult = await getCollabProjectsByIds(collabProjectIds);

        const ownedIds = new Set(ownedMapped.map((project) => String(project.id)));
        collabProjects = (collabProjectsResult.rows || [])
          .filter((project) => !ownedIds.has(String(project.id)))
          .map((project) => ({
            id: project.id,
            name: project.name,
            status: project.status,
            owner_id: project.owner_id,
            meta: project.meta,
            role: "collaborator",
            taskStats: {
              total: parseInt(project.task_total) || 0,
              completed: parseInt(project.task_completed) || 0,
            },
            blockerStats: { active: parseInt(project.blocker_active) || 0 },
            completionRate:
              (parseInt(project.task_total) || 0) > 0
                ? Math.round(
                    ((parseInt(project.task_completed) || 0) / (parseInt(project.task_total) || 1)) * 100,
                  )
                : 0,
          }));
      } catch (_) {}
    }

    userProjects.push(...ownedMapped, ...collabProjects);
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
