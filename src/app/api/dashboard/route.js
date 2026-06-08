import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * UNIFIED DASHBOARD API
 *
 * GET /api/dashboard
 *
 * Returns all data needed for the role-based unified dashboard in a single
 * optimized request.  The response shape adapts to the requesting user's role.
 *
 * Query params:
 *   user_id  – required, the CID or ID of the logged-in user
 *   role     – required, the user's role string
 *   year     – calendar year (default: current)
 *   month    – calendar month (1-12, default: current)
 *
 * Response sections:
 *   user         – { name, role, cid }
 *   calendar     – unified events from /api/calendar
 *   summary      – { programs, projects, tasks, blockers, overdueTasks, criticalBlockers }
 *   attention    – { overdueTasks[], criticalBlockers[], dueToday[] }
 *   activity     – recent 10 activity records
 *   quickAccess  – { programs[], projects[], tasks[], blockers[] } (max 5 each)
 *   assignments  – tasks assigned to user
 */

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const role = searchParams.get("role");
    const year = parseInt(searchParams.get("year")) || new Date().getFullYear();
    const month =
      parseInt(searchParams.get("month")) || new Date().getMonth() + 1;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }

    // ── 1. USER INFO ──
    let userName = "User";
    try {
      const userRes = await db.execute({
        sql: "SELECT name, email, role, cid FROM contacts WHERE cid = ?",
        args: [userId],
      });
      if (userRes.rows.length > 0) {
        userName = userRes.rows[0].name || "User";
      }
    } catch (_) {}

    // ── 2. CALENDAR EVENTS (from unified calendar API logic) ──
    const calendarEvents = [];

    // Tasks with dates
    try {
      const tasks = await db.execute({
        sql: `SELECT id, title, start_date, end_date, status, project_id, user_id, assigned_to
              FROM tasks
              WHERE (start_date IS NOT NULL OR end_date IS NOT NULL)
                AND (user_id = ? OR assigned_to = ?)`,
        args: [userId, userId],
      });
      for (const t of tasks.rows) {
        if (t.start_date) {
          calendarEvents.push({
            id: `task-${t.id}-start`,
            title: t.title,
            date: String(t.start_date).split("T")[0],
            type: "task_start",
            source: "task",
            status: t.status,
            related_id: t.id,
            project_id: t.project_id,
          });
        }
        if (t.end_date) {
          calendarEvents.push({
            id: `task-${t.id}-end`,
            title: `${t.title} (due)`,
            date: String(t.end_date).split("T")[0],
            type: "task_due",
            source: "task",
            status: t.status,
            related_id: t.id,
            project_id: t.project_id,
          });
        }
      }
    } catch (_) {}

    // Programs (always show – visibility handled by frontend)
    try {
      const programs = await db.execute({
        sql: `SELECT id, name, start_date, end_date, assigned_pm_id
              FROM v2_programs
              WHERE (start_date IS NOT NULL OR end_date IS NOT NULL)
                AND (assigned_pm_id = ? OR ? IN ('super_admin', 'admin'))`,
        args: [userId, role],
      });
      for (const p of programs.rows) {
        if (p.start_date) {
          calendarEvents.push({
            id: `program-${p.id}-start`,
            title: `${p.name} starts`,
            date: String(p.start_date).split("T")[0],
            type: "program_start",
            source: "program",
            status: "active",
            related_id: p.id,
          });
        }
        if (p.end_date) {
          calendarEvents.push({
            id: `program-${p.id}-end`,
            title: `${p.name} ends`,
            date: String(p.end_date).split("T")[0],
            type: "program_end",
            source: "program",
            status: "active",
            related_id: p.id,
          });
        }
      }
    } catch (_) {}

    // Sessions
    try {
      const sessions = await db.execute({
        sql: `SELECT s.id, s.title, s.start_at, s.type, s.teacher_id
              FROM v2_sessions s
              WHERE s.start_at IS NOT NULL
                AND s.teacher_id = ?`,
        args: [userId],
      });
      for (const s of sessions.rows) {
        calendarEvents.push({
          id: `session-${s.id}`,
          title: s.title,
          date: String(s.start_at).split("T")[0],
          type: "session",
          source: "session",
          status: "scheduled",
          related_id: s.id,
        });
      }
    } catch (_) {}

    // Deliverables (program-manager or admin)
    try {
      const delRes = await db.execute({
        sql: `SELECT d.id, d.title, d.due_date, d.program_id
              FROM v2_deliverables d
              JOIN v2_programs p ON d.program_id = p.id
              WHERE d.due_date IS NOT NULL
                AND (p.assigned_pm_id = ? OR ? IN ('super_admin', 'admin'))`,
        args: [userId, role],
      });
      for (const d of delRes.rows) {
        calendarEvents.push({
          id: `deliverable-${d.id}`,
          title: `${d.title} due`,
          date: String(d.due_date).split("T")[0],
          type: "deliverable_due",
          source: "deliverable",
          status: "pending",
          related_id: d.id,
        });
      }
    } catch (_) {}

    // v2_events (connected)
    try {
      const v2events = await db.execute({
        sql: `SELECT id, title, start_time, event_type, created_by
              FROM v2_events
              WHERE start_time IS NOT NULL
                AND created_by = ?`,
        args: [userId],
      });
      for (const e of v2events.rows) {
        calendarEvents.push({
          id: `v2event-${e.id}`,
          title: e.title,
          date: String(e.start_time).split("T")[0],
          type: "event",
          source: "event",
          status: "scheduled",
          related_id: e.id,
        });
      }
    } catch (_) {}

    // Filter to requested month
    const monthStr = String(month).padStart(2, "0");
    const monthEvents = calendarEvents.filter(
      (e) => e.date && e.date.startsWith(`${year}-${monthStr}`),
    );

    // ── 3. SUMMARY STATS ──

    // Tasks stats
    let totalTasks = 0;
    let openTasks = 0;
    let overdueTasks = 0;
    const overdueTaskList = [];
    const dueTodayList = [];
    try {
      const taskRes = await db.execute({
        sql: `SELECT id, title, end_date, status, priority, project_id
              FROM tasks
              WHERE (user_id = ? OR assigned_to = ?)`,
        args: [userId, userId],
      });
      totalTasks = taskRes.rows.length;
      const todayStr = new Date().toISOString().split("T")[0];
      for (const t of taskRes.rows) {
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
    } catch (_) {}

    // Blocker stats
    let activeBlockers = 0;
    let criticalBlockers = 0;
    const criticalBlockerList = [];
    try {
      const blockerRes = await db.execute({
        sql: `SELECT b.id, b.title, b.severity, b.status, b.task_id, t.project_id, t.title AS task_title
              FROM blockers b
              JOIN tasks t ON b.task_id = t.id
              WHERE b.status = 'active'
                AND (t.user_id = ? OR t.assigned_to = ?)
              ORDER BY
                CASE b.severity
                  WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                  WHEN 'medium' THEN 2 WHEN 'low' THEN 3
                  ELSE 4
                END`,
        args: [userId, userId],
      });
      activeBlockers = blockerRes.rows.length;
      for (const b of blockerRes.rows) {
        if (b.severity === "critical" || b.severity === "high") {
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
    } catch (_) {}

    // All blockers (for quick access)
    const allBlockers = [...criticalBlockerList];
    try {
      if (allBlockers.length < 5) {
        const moreBlockers = await db.execute({
          sql: `SELECT b.id, b.title, b.severity, b.status
                FROM blockers b
                JOIN tasks t ON b.task_id = t.id
                WHERE b.status = 'active'
                  AND (t.user_id = ? OR t.assigned_to = ?)
                LIMIT 5`,
          args: [userId, userId],
        });
        for (const b of moreBlockers.rows) {
          if (!allBlockers.find((cb) => cb.id === b.id)) {
            allBlockers.push(b);
          }
        }
      }
    } catch (_) {}

    // Programs count (PM or admin)
    let programCount = 0;
    let userPrograms = [];
    try {
      const progRes = await db.execute({
        sql: `SELECT id, name, status
              FROM v2_programs
              WHERE assigned_pm_id = ?
                 OR ? IN ('super_admin', 'admin')
              ORDER BY created_at DESC`,
        args: [userId, role],
      });
      programCount = progRes.rows.length;
      userPrograms = progRes.rows.slice(0, 5);
    } catch (_) {}

    // Projects where user is owner or collaborator (with task/blocker stats)
    let projectCount = 0;
    let userProjects = [];
    try {
      // Owned: owner_id matches user, OR assigned_pm_id in meta matches (legacy)
      const ownedProjRes = await db.execute({
        sql: `SELECT
                p.id, p.name, p.status, p.owner_id, p.meta,
                COALESCE(t_stats.total, 0) AS task_total,
                COALESCE(t_stats.completed, 0) AS task_completed,
                COALESCE(b_stats.active, 0) AS blocker_active
              FROM v2_projects p
              LEFT JOIN (
                SELECT project_id,
                       COUNT(*) AS total,
                       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
                FROM tasks
                GROUP BY project_id
              ) t_stats ON p.id = t_stats.project_id
              LEFT JOIN (
                SELECT t.project_id,
                       COUNT(*) AS active
                FROM blockers b
                JOIN tasks t ON b.task_id = t.id
                WHERE b.status = 'active'
                GROUP BY t.project_id
              ) b_stats ON p.id = b_stats.project_id
              WHERE p.owner_id = ?
                 OR ? IN ('super_admin', 'admin')
              ORDER BY p.created_at DESC`,
        args: [userId, role],
      });

      // Collaborator: user is in project_members but not owner
      let collabProjectIds = [];
      try {
        const collabRes = await db.execute({
          sql: `SELECT DISTINCT project_id FROM project_members WHERE user_cid = ?`,
          args: [userId],
        });
        collabProjectIds = collabRes.rows.map((r) => r.project_id);
      } catch (_) {}

      let collabProjects = [];
      if (collabProjectIds.length > 0) {
        const placeholders = collabProjectIds.map(() => "?").join(",");
        const collabProjRes = await db.execute({
          sql: `SELECT
                  p.id, p.name, p.status, p.owner_id, p.meta,
                  COALESCE(t_stats.total, 0) AS task_total,
                  COALESCE(t_stats.completed, 0) AS task_completed,
                  COALESCE(b_stats.active, 0) AS blocker_active
                FROM v2_projects p
                LEFT JOIN (
                  SELECT project_id,
                         COUNT(*) AS total,
                         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
                  FROM tasks
                  GROUP BY project_id
                ) t_stats ON p.id = t_stats.project_id
                LEFT JOIN (
                  SELECT t.project_id,
                         COUNT(*) AS active
                  FROM blockers b
                  JOIN tasks t ON b.task_id = t.id
                  WHERE b.status = 'active'
                  GROUP BY t.project_id
                ) b_stats ON p.id = b_stats.project_id
                WHERE p.id IN (${placeholders})
                ORDER BY p.created_at DESC`,
          args: collabProjectIds,
        });
        collabProjects = collabProjRes.rows;
      }

      // Map owned projects with role="owner"
      const ownedMapped = (ownedProjRes.rows || []).map((p) => {
        const total = parseInt(p.task_total) || 0;
        const completed = parseInt(p.task_completed) || 0;
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          owner_id: p.owner_id,
          meta: p.meta,
          role: "owner",
          taskStats: { total, completed },
          blockerStats: { active: parseInt(p.blocker_active) || 0 },
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });

      // Map collaborator projects with role="collaborator" (excluding owned)
      const ownedIds = new Set(ownedMapped.map((p) => String(p.id)));
      const collabMapped = (collabProjects || [])
        .filter((p) => !ownedIds.has(String(p.id)))
        .map((p) => {
          const total = parseInt(p.task_total) || 0;
          const completed = parseInt(p.task_completed) || 0;
          return {
            id: p.id,
            name: p.name,
            status: p.status,
            owner_id: p.owner_id,
            meta: p.meta,
            role: "collaborator",
            taskStats: { total, completed },
            blockerStats: { active: parseInt(p.blocker_active) || 0 },
            completionRate:
              total > 0 ? Math.round((completed / total) * 100) : 0,
          };
        });

      userProjects = [...ownedMapped, ...collabMapped];
      projectCount = userProjects.length;
    } catch (_) {}

    // ── 4. RECENT ACTIVITY ──
    let activity = [];
    try {
      const actRes = await db.execute({
        sql: `(SELECT 'task_completed' AS action, title AS description, updated_at AS timestamp, user_id
               FROM tasks WHERE (user_id = ? OR assigned_to = ?) AND status = 'completed'
               ORDER BY updated_at DESC LIMIT 5)
              UNION ALL
              (SELECT 'blocker_resolved' AS action, title AS description, resolved_at AS timestamp, resolved_by AS user_id
               FROM blockers WHERE resolved_by = ? AND status = 'resolved'
               ORDER BY resolved_at DESC LIMIT 3)
              UNION ALL
              (SELECT 'task_assigned' AS action, title AS description, created_at AS timestamp, user_id
               FROM tasks WHERE assigned_to = ?
               ORDER BY created_at DESC LIMIT 3)
              ORDER BY timestamp DESC LIMIT 10`,
        args: [userId, userId, userId, userId],
      });
      activity = actRes.rows;
    } catch (_) {}

    // ── 5. ASSIGNMENTS (tasks assigned TO user by others) ──
    let assignments = [];
    try {
      const assignRes = await db.execute({
        sql: `SELECT id, title, status, end_date, user_name, user_id, priority, created_at
              FROM tasks
              WHERE assigned_to = ?
              ORDER BY created_at DESC`,
        args: [userId],
      });
      assignments = assignRes.rows;
    } catch (_) {}

    // ── 6. USER'S OWN TASKS (for quick access / attention section) ──
    let myTasks = [];
    try {
      const taskRes = await db.execute({
        sql: `SELECT id, title, status, end_date, priority, project_id
              FROM tasks
              WHERE user_id = ?
              ORDER BY
                CASE status
                  WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1
                  WHEN 'blocked' THEN 2 WHEN 'carried_over' THEN 3
                  ELSE 4
                END,
                end_date ASC NULLS LAST
              LIMIT 5`,
        args: [userId],
      });
      myTasks = taskRes.rows;
    } catch (_) {}

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
      assignments: assignments.filter((a) => a.status !== "completed"),
    });
  } catch (error) {
    console.error("Unified Dashboard API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
