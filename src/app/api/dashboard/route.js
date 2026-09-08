import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
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

/**
 * UNIFIED DASHBOARD API — OPTIMIZED (parallel queries)
 *
 * GET /api/dashboard?user_id=X&role=Y&year=2026&month=7
 *
 * All independent database queries run in parallel via Promise.all.
 * Response time = slowest single query, not sum of all queries.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);

    // Shortcut: KPI summary for Super Admin dashboard (no user_id required)
    if (searchParams.get("summary") === "true") {
      const authError = await requireAuth(["super_admin"]);
      if (authError) return authError;
      const kpiRes = await getProgramKpiSummary();
      return NextResponse.json({ success: true, programs: kpiRes.rows });
    }

    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const requestedUserId = searchParams.get("user_id");
    const requestedRole = searchParams.get("role");
    const year = parseInt(searchParams.get("year")) || new Date().getFullYear();
    const month = parseInt(searchParams.get("month")) || new Date().getMonth() + 1;

    // SECURITY PATCH: Prevent IDOR by enforcing session identity.
    // Only allow super_admin or admin to view other users' dashboards.
    const isSessionAdmin = session.role === "super_admin" || session.role === "admin";
    const userId = (isSessionAdmin && requestedUserId) ? requestedUserId : session.cid;
    const role = (isSessionAdmin && requestedRole) ? requestedRole : session.role;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const isAdmin = role === "super_admin" || role === "admin";

    // ─────────────────────────────────────────────
    // PHASE 1: All independent queries in parallel
    // ─────────────────────────────────────────────
    const [
      userRes,
      taskDateRes,
      progDateRes,
      sessRes,
      delRes,
      eventRes,
      taskStatsRes,
      blockerRes,
      progCountRes,
      ownedProjRes,
      collabMembersRes,
      activityRes,
      assignmentsRes,
      myTasksRes,
      kpiRes,
    ] = await Promise.allSettled([
      // 1. User info
      getUserIdentity(userId),

      // 2. Tasks with dates (calendar) — include task_name/user_name
      getCalendarTasks(userId),

      // 3. Programs with dates (calendar)
      getCalendarPrograms(userId, role),

      // 4. Sessions (calendar)
      getCalendarSessions(userId, role),

      // 5. Deliverables (calendar)
      getCalendarDeliverables(userId, role),

      // 6. v2_events (calendar)
      getCalendarEvents(userId),

      // 7. Task stats (summary + overdue + due today)
      // Only top-level tasks count as tasks — subtasks are tracked via their parent.
      getTopLevelTasks(userId),

      // 8. Active blockers
      getActiveBlockers(userId),

      // 9. Programs count (PM or admin)
      getVisiblePrograms(userId, role),

      // 10. Owned projects (with task/blocker stats)
      getOwnedProjectsWithStats(userId, role),

      // 11. Collaborator project IDs (needed for phase 2)
      getCollabProjectIds(userId),

      // 12. Recent activity
      getRecentActivity(userId),

      // 13. Assignments (tasks assigned TO user)
      getAssignedTasks(userId),

      // 14. User's own tasks (quick access)
      getQuickAccessTasks(userId),

      // 15. KPI Progress (cached — updated on submissions approval)
      getKpiProgressRows(userId),
    ]);

    // ─────────────────────────────────────────────
    // PHASE 2: Process results
    // ─────────────────────────────────────────────

    // 1. User info
    let userName = "User";
    if (userRes.status === "fulfilled" && userRes.value.rows.length > 0) {
      userName = userRes.value.rows[0].name || "User";
    }

    // Helper: convert any date format (Date object, ISO string, etc.) to YYYY-MM-DD
    const toDateStr = (val) => {
      if (!val) return null;
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split("T")[0];
      } catch {
        return null;
      }
    };

    // Helper: generate all dates from start to end (inclusive)
    const dateRange = (start, end) => {
      const dates = [];
      const s = new Date(start + "T00:00:00Z");
      const e = new Date(end + "T00:00:00Z");
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return dates;
      const cur = new Date(s);
      while (cur <= e) {
        dates.push(cur.toISOString().split("T")[0]);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      return dates;
    };

    // 2. Calendar events
    const calendarEvents = [];

    // Tasks → calendar — span all days from start_date to end_date
    if (taskDateRes.status === "fulfilled") {
      for (const t of taskDateRes.value.rows) {
        const startStr = toDateStr(t.start_date);
        const endStr = toDateStr(t.end_date);
        // If no dates at all, show on today
        if (!startStr && !endStr) {
          calendarEvents.push({
            id: `task-${t.id}-${todayStr}`,
            title: t.title,
            date: todayStr,
            type: "task_active",
            source: "task",
            status: t.status,
            priority: t.priority,
            related_id: t.id,
            project_id: t.project_id,
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
            id: `task-${t.id}-${day}`,
            title: t.title,
            date: day,
            type: isFirst ? "task_start" : isLast ? "task_due" : "task_active",
            source: "task",
            status: t.status,
            priority: t.priority,
            related_id: t.id,
            project_id: t.project_id,
          });
        }
      }
    }

    // Programs → calendar
    if (progDateRes.status === "fulfilled") {
      for (const p of progDateRes.value.rows) {
        if (p.start_date) {
          const d = toDateStr(p.start_date);
          if (d)
            calendarEvents.push({
              id: `program-${p.id}-start`,
              title: `${p.name} starts`,
              date: d,
              type: "program_start",
              source: "program",
              status: "active",
              related_id: p.id,
            });
        }
        if (p.end_date) {
          const d = toDateStr(p.end_date);
          if (d)
            calendarEvents.push({
              id: `program-${p.id}-end`,
              title: `${p.name} ends`,
              date: d,
              type: "program_end",
              source: "program",
              status: "active",
              related_id: p.id,
            });
        }
      }
    }

    // Sessions → calendar
    if (sessRes.status === "fulfilled") {
      for (const s of sessRes.value.rows) {
        calendarEvents.push({
          id: `session-${s.id}`,
          title: s.title,
          date: toDateStr(s.start_at),
          type: "session",
          source: "session",
          status: "scheduled",
          related_id: s.id,
          project_id: s.program_id,
        });
      }
    }

    // Deliverables → calendar
    if (delRes.status === "fulfilled") {
      for (const d of delRes.value.rows) {
        calendarEvents.push({
          id: `deliverable-${d.id}`,
          title: `${d.title} due`,
          date: toDateStr(d.due_date),
          type: "deliverable_due",
          source: "deliverable",
          status: "pending",
          related_id: d.id,
        });
      }
    }

    // v2_events → calendar
    if (eventRes.status === "fulfilled") {
      for (const e of eventRes.value.rows) {
        calendarEvents.push({
          id: `v2event-${e.id}`,
          title: e.title,
          date: toDateStr(e.start_time),
          type: "event",
          source: "event",
          status: "scheduled",
          related_id: e.id,
        });
      }
    }

    // Filter calendar to requested month
    const monthStr = String(month).padStart(2, "0");
    const monthEvents = calendarEvents.filter(
      (e) => e.date && e.date.startsWith(`${year}-${monthStr}`),
    );

    // 3. Task stats
    let totalTasks = 0,
      openTasks = 0,
      overdueTasks = 0;
    const overdueTaskList = [],
      dueTodayList = [];

    if (taskStatsRes.status === "fulfilled") {
      totalTasks = taskStatsRes.value.rows.length;
      for (const t of taskStatsRes.value.rows) {
        if (t.status !== "completed") openTasks++;
        if (
          t.end_date &&
          t.status !== "completed" &&
          String(t.end_date).split("T")[0] < todayStr
        ) {
          overdueTasks++;
          overdueTaskList.push({
            id: t.id,
            title: t.title,
            due_date: t.end_date,
            priority: t.priority,
            project_id: t.project_id,
          });
        }
        if (
          t.end_date &&
          t.status !== "completed" &&
          String(t.end_date).split("T")[0] === todayStr
        ) {
          dueTodayList.push({
            id: t.id,
            title: t.title,
            type: "task",
            related_id: t.id,
            project_id: t.project_id,
          });
        }
      }
    }

    // 4. Blocker stats
    let activeBlockers = 0,
      criticalBlockers = 0;
    const criticalBlockerList = [];
    const allBlockers = [];

    if (blockerRes.status === "fulfilled") {
      activeBlockers = blockerRes.value.rows.length;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const b of blockerRes.value.rows) {
        if (b.severity === "critical" || b.severity === "high") {
          let includeBlocker = true;
          if (b.end_date) {
            const dueDate = new Date(b.end_date);
            dueDate.setHours(0, 0, 0, 0);
            includeBlocker = dueDate <= today;
          }
          if (includeBlocker) {
            criticalBlockers++;
            criticalBlockerList.push({
              id: b.id,
              title: b.title,
              severity: b.severity,
              task_id: b.task_id,
              task_title: b.task_title,
              project_id: b.project_id,
            });
          }
        }
        allBlockers.push(b);
      }
    }

    // 5. Programs
    let programCount = 0;
    const userPrograms = [];
    if (progCountRes.status === "fulfilled") {
      programCount = progCountRes.value.rows.length;
      userPrograms.push(...progCountRes.value.rows.slice(0, 5));
    }

    // 6. Projects (owned + collaborator)
    let projectCount = 0;
    const userProjects = [];
    let collabProjects = [];

    if (
      ownedProjRes.status === "fulfilled" &&
      collabMembersRes.status === "fulfilled"
    ) {
      // Map owned projects
      const ownedMapped = (ownedProjRes.value.rows || []).map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        owner_id: p.owner_id,
        meta: p.meta,
        role: "owner",
        taskStats: {
          total: parseInt(p.task_total) || 0,
          completed: parseInt(p.task_completed) || 0,
        },
        blockerStats: { active: parseInt(p.blocker_active) || 0 },
        completionRate:
          (parseInt(p.task_total) || 0) > 0
            ? Math.round(
                ((parseInt(p.task_completed) || 0) /
                  (parseInt(p.task_total) || 1)) *
                  100,
              )
            : 0,
      }));

      // Collaborator projects
      const collabProjectIds = collabMembersRes.value.rows.map(
        (r) => r.project_id,
      );
      if (collabProjectIds.length > 0) {
        try {
          const collabProjRes = await getCollabProjectsByIds(collabProjectIds);

          const ownedIds = new Set(ownedMapped.map((p) => String(p.id)));
          collabProjects = (collabProjRes.rows || [])
            .filter((p) => !ownedIds.has(String(p.id)))
            .map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              owner_id: p.owner_id,
              meta: p.meta,
              role: "collaborator",
              taskStats: {
                total: parseInt(p.task_total) || 0,
                completed: parseInt(p.task_completed) || 0,
              },
              blockerStats: { active: parseInt(p.blocker_active) || 0 },
              completionRate:
                (parseInt(p.task_total) || 0) > 0
                  ? Math.round(
                      ((parseInt(p.task_completed) || 0) /
                        (parseInt(p.task_total) || 1)) *
                        100,
                    )
                  : 0,
            }));
        } catch (_) {}
      }

      userProjects.push(...ownedMapped, ...collabProjects);
      projectCount = userProjects.length;
    }

    // 7. Activity
    let activity = [];
    if (activityRes.status === "fulfilled") {
      activity = activityRes.value.rows;
    }

    // 8. Assignments
    let assignments = [];
    if (assignmentsRes.status === "fulfilled") {
      assignments = assignmentsRes.value.rows;
    }

    // 9. My tasks
    let myTasks = [];
    if (myTasksRes.status === "fulfilled") {
      myTasks = myTasksRes.value.rows;
    }

    // 10. KPI Progress
    let kpiProgress = [];
    if (kpiRes.status === "fulfilled") {
      kpiProgress = kpiRes.value.rows;
    }

    // ─────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────
    return NextResponse.json({
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
      activity: activity.map((a) => ({
        action: a.action,
        description: a.description,
        timestamp: a.timestamp,
        user_id: a.user_id,
      })),
      quickAccess: {
        programs: userPrograms,
        projects: userProjects,
        tasks: myTasks,
        blockers: allBlockers.slice(0, 5),
      },
      assignments,
      kpis: kpiProgress,
    });
  } catch (error) {
    console.error("GET dashboard error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
