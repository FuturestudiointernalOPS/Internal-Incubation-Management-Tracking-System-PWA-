import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

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
    const authError = await requireAuth();
    if (authError) return authError;
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
      db.execute({
        sql: "SELECT name, email, role, cid FROM contacts WHERE cid = ?",
        args: [userId],
      }),

      // 2. Tasks with dates (calendar) — include task_name/user_name
      db.execute({
        sql: `SELECT id, title, description, start_date, end_date, status, priority, category, project_id, user_id, user_name, assigned_to, link
              FROM tasks
              WHERE (user_id = ? OR assigned_to = ?)`,
        args: [userId, userId],
      }),

      // 3. Programs with dates (calendar)
      db.execute({
        sql: `SELECT id, name, start_date, end_date, assigned_pm_id
              FROM v2_programs
              WHERE (start_date IS NOT NULL OR end_date IS NOT NULL)
                AND (assigned_pm_id = ? OR ? IN ('super_admin', 'admin'))`,
        args: [userId, role],
      }),

      // 4. Sessions (calendar)
      db.execute({
        sql: `SELECT s.id, s.title, s.start_at, s.teacher_id, s.program_id, p.name AS program_name
              FROM v2_sessions s
              LEFT JOIN v2_programs p ON s.program_id = p.id
              WHERE s.start_at IS NOT NULL
                AND (s.teacher_id = ? OR s.program_id IN (
                  SELECT id FROM v2_programs WHERE assigned_pm_id = ?
                ) OR ? IN ('super_admin', 'admin'))`,
        args: [userId, userId, role],
      }),

      // 5. Deliverables (calendar)
      db.execute({
        sql: `SELECT d.id, d.title, d.due_date, d.program_id
              FROM v2_deliverables d
              JOIN v2_programs p ON d.program_id = p.id
              WHERE d.due_date IS NOT NULL
                AND (p.assigned_pm_id = ? OR ? IN ('super_admin', 'admin'))`,
        args: [userId, role],
      }),

      // 6. v2_events (calendar)
      db.execute({
        sql: `SELECT id, title, start_time, event_type, created_by
              FROM v2_events
              WHERE start_time IS NOT NULL
                AND created_by = ?`,
        args: [userId],
      }),

      // 7. Task stats (summary + overdue + due today)
      db.execute({
        sql: `SELECT id, title, end_date, status, priority, project_id
              FROM tasks
              WHERE (user_id = ? OR assigned_to = ?)`,
        args: [userId, userId],
      }),

      // 8. Active blockers
      db.execute({
        sql: `SELECT b.id, b.title, b.severity, b.status, b.task_id, t.project_id, t.title AS task_title, t.end_date
              FROM blockers b
              JOIN tasks t ON b.task_id = t.id
              WHERE b.status = 'active'
                AND (t.user_id = ? OR t.assigned_to = ?)
              ORDER BY CASE b.severity
                WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
              END`,
        args: [userId, userId],
      }),

      // 9. Programs count (PM or admin)
      db.execute({
        sql: `SELECT id, name, status
              FROM v2_programs
              WHERE assigned_pm_id = ?
                 OR ? IN ('super_admin', 'admin')
              ORDER BY created_at DESC`,
        args: [userId, role],
      }),

      // 10. Owned projects (with task/blocker stats)
      db.execute({
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
                FROM tasks GROUP BY project_id
              ) t_stats ON p.id = t_stats.project_id
              LEFT JOIN (
                SELECT t.project_id, COUNT(*) AS active
                FROM blockers b JOIN tasks t ON b.task_id = t.id
                WHERE b.status = 'active' GROUP BY t.project_id
              ) b_stats ON p.id = b_stats.project_id
              WHERE (p.owner_id::text = ?::text OR EXISTS (
                SELECT 1 FROM project_members pm
                WHERE pm.project_id::text = p.id::text AND pm.user_cid::text = ?::text AND pm.role = 'lead'
              )) OR ?::text IN ('super_admin', 'admin')
              ORDER BY p.created_at DESC`,
        args: [userId, userId, role],
      }),

      // 11. Collaborator project IDs (needed for phase 2)
      db.execute({
        sql: `SELECT DISTINCT project_id FROM project_members WHERE user_cid = ?`,
        args: [userId],
      }),

      // 12. Recent activity
      db.execute({
        sql: `(SELECT 'task_completed' AS action, title AS description, updated_at AS timestamp, user_id::text
               FROM tasks WHERE (user_id::text = ?::text OR assigned_to::text = ?::text) AND status = 'completed'
               ORDER BY updated_at DESC LIMIT 5)
              UNION ALL
              (SELECT 'blocker_resolved' AS action, title AS description, resolved_at AS timestamp, resolved_by::text AS user_id
               FROM blockers WHERE resolved_by::text = ?::text AND status = 'resolved'
               ORDER BY resolved_at DESC LIMIT 3)
              UNION ALL
              (SELECT 'task_assigned' AS action, title AS description, created_at AS timestamp, user_id::text
               FROM tasks WHERE assigned_to::text = ?::text
               ORDER BY created_at DESC LIMIT 3)
              UNION ALL
              (SELECT action, details AS description, created_at AS timestamp, user_id
               FROM audit_log WHERE entity_type = 'program_assignment' AND user_id = ?
               ORDER BY created_at DESC LIMIT 3)
              ORDER BY timestamp DESC LIMIT 10`,
        args: [userId, userId, userId, userId, userId],
      }),

      // 13. Assignments (tasks assigned TO user)
      db.execute({
        sql: `SELECT id, title, status, end_date, user_name, user_id, priority, created_at
              FROM tasks WHERE assigned_to::text = ?::text ORDER BY created_at DESC`,
        args: [userId],
      }),

      // 14. User's own tasks (quick access)
      db.execute({
        sql: `SELECT id, title, status, end_date, priority, project_id
              FROM tasks WHERE user_id::text = ?::text
              ORDER BY
                CASE status
                  WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1
                  WHEN 'blocked' THEN 2 WHEN 'carried_over' THEN 3 ELSE 4
                END,
                end_date ASC NULLS LAST
              LIMIT 5`,
        args: [userId],
      }),

      // 15. KPI Progress (for program managers) — includes participant counts
      db.execute({
        sql: `SELECT k.program_id, k.id AS kpi_id, k.title, k.weight, k.target_value, k.auto_weight,
                     COUNT(DISTINCT s.participant_id) AS approved_count,
                     (SELECT COUNT(DISTINCT p2.id) FROM v2_participants p2 WHERE p2.program_id::text = k.program_id::text) AS participant_count
              FROM v2_kpis k
              LEFT JOIN v2_document_requirements d ON d.program_id::text = k.program_id::text AND POSITION(k.id::text IN CAST(d.kpi_ids AS TEXT)) > 0
              LEFT JOIN v2_submissions s ON s.deliverable_id::text = d.id::text AND s.status = 'approved'
              WHERE k.program_id IN (SELECT program_id::text FROM v2_programs WHERE assigned_pm_id = ? OR assigned_assistant_id LIKE ? OR id::text IN (SELECT program_id::text FROM v2_teams WHERE handler_id = ?))
              GROUP BY k.program_id, k.id, k.title, k.weight, k.target_value, k.auto_weight
              ORDER BY k.program_id, k.id`,
        args: [userId, `%${userId}%`, userId],
      }),
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
          const placeholders = collabProjectIds.map(() => "?").join(",");
          const collabProjRes = await db.execute({
            sql: `SELECT
                    p.id, p.name, p.status, p.owner_id, p.meta,
                    COALESCE(t_stats.total, 0) AS task_total,
                    COALESCE(t_stats.completed, 0) AS task_completed,
                    COALESCE(b_stats.active, 0) AS blocker_active
                  FROM v2_projects p
                  LEFT JOIN (
                    SELECT project_id, COUNT(*) AS total,
                           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
                    FROM tasks GROUP BY project_id
                  ) t_stats ON p.id = t_stats.project_id
                  LEFT JOIN (
                    SELECT t.project_id, COUNT(*) AS active
                    FROM blockers b JOIN tasks t ON b.task_id = t.id
                    WHERE b.status = 'active' GROUP BY t.project_id
                  ) b_stats ON p.id = b_stats.project_id
                  WHERE p.id IN (${placeholders})
                  ORDER BY p.created_at DESC`,
            args: collabProjectIds,
          });

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
