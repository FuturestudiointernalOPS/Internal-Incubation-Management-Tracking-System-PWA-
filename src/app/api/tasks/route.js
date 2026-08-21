import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent, isTaskLocked } from "@/lib/audit";
import { logTaskEvent, ACTION_TYPES } from "@/lib/taskAudit";
import { requireAuth } from "@/lib/auth";
import { standupUpsert } from "@/lib/standupUpsert";
import { completeCarryoverAncestors } from "@/lib/taskCarryover";
import {
  getTaskById,
  getTaskTitleById,
  getTaskEndDateById,
} from "@/lib/db/queries/tasks";

/**
 * TASKS API
 *
 * GET   /api/tasks?user_id=X&status=in_progress&week=12&year=2026
 * POST  /api/tasks
 * PUT   /api/tasks
 * DELETE /api/tasks?id=X
 *
 * Locking Rule (Phase 6):
 *   After 12 hours, task title/description cannot be modified and task cannot be deleted.
 *   Status updates, progress updates, and blocker updates are still allowed.
 *
 * Audit Trail (Phase 10):
 *   All lifecycle events are logged.
 */

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// ── Date validation helpers ──
function isValidDateStr(v) {
  return (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !isNaN(new Date(v + "T00:00:00Z").getTime())
  );
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function isCurrentWeek(w, y) {
  const now = new Date();
  return Number(w) === getWeekNumber(now) && Number(y) === now.getFullYear();
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    const assigned_to = searchParams.get("assigned_to");
    const project_id_filter = searchParams.get("project_id");

    // SECURITY (Phase 0): Users see their own tasks + tasks assigned to them.
    // Super admin can see all but only within their authorized contexts.
    const sessionCid = session.cid;

    // SECURITY: When a non-SA explicitly requests another user's tasks,
    // block unless the requester is that user's supervisor or has context access.
    if (session.role !== "super_admin" && user_id && user_id !== sessionCid) {
      // Allow if the requester has a task assigned to the target user
      // (supervisor check will be added in Phase 4 when intents exist)
      return NextResponse.json(
        { success: false, error: "You can only access your own tasks." },
        { status: 403 },
      );
    }
    const status = searchParams.get("status");
    const week_number = searchParams.get("week");
    const year = searchParams.get("year");
    const role = searchParams.get("role");
    const id = searchParams.get("id");
    const sort = searchParams.get("sort");
    const limit = searchParams.get("limit");
    const brief = searchParams.get("brief") === "true";
    const priority = searchParams.get("priority");

    let sql = "SELECT * FROM tasks WHERE 1=1";
    const args = [];

    if (id) {
      sql += " AND id = ?";
      args.push(parseInt(id));
      const result = await db.execute({ sql, args });
      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Task not found" },
          { status: 404 },
        );
      }
      const task = result.rows[0];

      // SECURITY (Phase 0/6): ID lookup must still enforce authorization.
      // Only the task owner, assignee, supervisor, or super_admin can view a task by ID.
      if (
        session.role !== "super_admin" &&
        String(task.user_id) !== String(sessionCid) &&
        String(task.assigned_to || "") !== String(sessionCid) &&
        String(task.supervisor_id || "") !== String(sessionCid)
      ) {
        return NextResponse.json(
          { success: false, error: "You do not have access to this task." },
          { status: 403 },
        );
      }

      // Fetch blockers + subtasks for this single task
      const blockerRes = await db.execute({
        sql: "SELECT id, title, status, severity, description, reference_url, notes FROM blockers WHERE task_id = ?",
        args: [parseInt(id)],
      });
      const subtaskRes = await db.execute({
        sql: "SELECT id, title, status FROM tasks WHERE parent_task_id = ?",
        args: [parseInt(id)],
      });
      return NextResponse.json({
        success: true,
        tasks: [
          {
            ...task,
            blockers: blockerRes.rows || [],
            subtasks: subtaskRes.rows || [],
          },
        ],
      });
    }

    // SECURITY (Phase 0/6): For non-SA users, scope to: owned tasks, assigned tasks, or supervised tasks.
    // When an explicit assigned_to filter is given, use that. Otherwise scope by session user.
    if (session.role !== "super_admin") {
      if (!user_id && !assigned_to) {
        // No user/assignee filter given (with or without project_id): force scope to session user
        sql += " AND (user_id = ? OR assigned_to = ? OR supervisor_id = ?)";
        args.push(sessionCid, sessionCid, sessionCid);
      } else if (user_id) {
        // Explicit user_id filter (pre-authorized above): scope to that user
        sql += " AND user_id = ?";
        args.push(user_id);
        if (assigned_to) {
          sql += " AND assigned_to = ?";
          args.push(assigned_to);
        }
      } else if (assigned_to) {
        // Non-SA requesting by assigned_to: only allow viewing own assignments
        if (assigned_to !== sessionCid) {
          return NextResponse.json(
            { success: false, error: "You can only view tasks assigned to yourself." },
            { status: 403 },
          );
        }
        sql += " AND assigned_to = ?";
        args.push(assigned_to);
      }
    } else {
      // Super admin: apply filters as requested
      if (user_id) {
        sql += " AND user_id = ?";
        args.push(user_id);
      }
      if (assigned_to) {
        sql += " AND assigned_to = ?";
        args.push(assigned_to);
      }
    }

    if (project_id_filter) {
      sql += " AND project_id::text = ?";
      args.push(project_id_filter);
    }

    if (status) {
      sql += " AND status = ?";
      args.push(status);
    }

    if (priority) {
      sql += " AND priority = ?";
      args.push(priority);
    }

    if (week_number) {
      sql += " AND created_week = ?";
      args.push(parseInt(week_number));
    }

    if (year) {
      sql += " AND created_year = ?";
      args.push(parseInt(year));
    }

    // Sorting
    switch (sort) {
      case "oldest":
        sql += " ORDER BY created_at ASC";
        break;
      case "updated":
        sql += " ORDER BY updated_at DESC";
        break;
      case "priority":
        sql +=
          " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, created_at DESC";
        break;
      default:
        sql += " ORDER BY created_at DESC";
    }

    if (limit) {
      sql += " LIMIT ?";
      args.push(parseInt(limit));
    }

    const result = await db.execute({ sql, args });

    // For brief fetches (tasks tab), skip blockers/subtasks to avoid N+1 perf hit
    if (brief) {
      return NextResponse.json({ success: true, tasks: result.rows });
    }

    // Batch fetch blockers for all tasks (2 queries total instead of N+1)
    const taskIds = result.rows.map((t) => t.id);
    let blockersByTask = {};
    let subtasksByTask = {};
    let resourcesByTask = {};
    let commentCountByTask = {};
    let allTaskIds = [...taskIds];

    if (taskIds.length > 0) {
      // Single batch query for all blockers
      const blockerRes = await db.execute({
        sql: `SELECT id, title, status, severity, description, reference_url, notes, task_id FROM blockers WHERE task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at DESC`,
        args: taskIds,
      });
      for (const b of blockerRes.rows || []) {
        const tid = b.task_id;
        if (!blockersByTask[tid]) blockersByTask[tid] = [];
        blockersByTask[tid].push({
          id: b.id,
          title: b.title,
          status: b.status,
          severity: b.severity,
          description: b.description,
          reference_url: b.reference_url,
          notes: b.notes,
        });
      }

      // Single batch query for all subtasks — include full field set (Ticket 1.3)
      try {
        const subtaskRes = await db.execute({
          sql: `SELECT id, title, description, status, priority, assigned_to,
                        start_date, end_date, created_week, created_year,
                        link, parent_task_id
                FROM tasks
                WHERE parent_task_id IN (${taskIds.map(() => "?").join(",")})
                ORDER BY created_at ASC`,
          args: taskIds,
        });
        for (const s of subtaskRes.rows || []) {
          const pid = s.parent_task_id;
          if (!subtasksByTask[pid]) subtasksByTask[pid] = [];
          subtasksByTask[pid].push(s);
          allTaskIds.push(s.id);
        }
      } catch (e) {
        // parent_task_id column may not exist yet
      }

      // Single batch query for all resources (tasks + subtasks)
      try {
        const resourceRes = await db.execute({
          sql: `SELECT id, name, url, task_id, type, file_name, file_size, uploaded_by FROM task_resources WHERE task_id IN (${allTaskIds.map(() => "?").join(",")}) ORDER BY created_at ASC`,
          args: allTaskIds,
        });
        for (const r of resourceRes.rows || []) {
          const tid = r.task_id;
          if (!resourcesByTask[tid]) resourcesByTask[tid] = [];
          resourcesByTask[tid].push({
            id: r.id,
            name: r.name,
            url: r.url,
            type: r.type,
            file_name: r.file_name,
            file_size: r.file_size,
            uploaded_by: r.uploaded_by,
          });
        }
      } catch (e) {
        // task_resources table may not exist yet in some environments
      }

      // Comment counts (tasks + subtasks) — full thread fetched on-demand per task
      try {
        const commentRes = await db.execute({
          sql: `SELECT task_id, COUNT(*) AS cnt FROM v2_task_comments WHERE task_id IN (${allTaskIds.map(() => "?").join(",")}) GROUP BY task_id`,
          args: allTaskIds,
        });
        for (const c of commentRes.rows || []) {
          commentCountByTask[c.task_id] = parseInt(c.cnt) || 0;
        }
      } catch (e) {
        // v2_task_comments table may not exist yet in some environments
      }
    }

    // Attach resources/comment counts onto subtasks now that we have them
    for (const pid of Object.keys(subtasksByTask)) {
      subtasksByTask[pid] = subtasksByTask[pid].map((s) => ({
        ...s,
        resources: resourcesByTask[s.id] || [],
        commentCount: commentCountByTask[s.id] || 0,
      }));
    }

    // Map results
    const tasksWithBlockers = result.rows.map((task) => ({
      ...task,
      blockers: blockersByTask[task.id] || [],
      subtasks: subtasksByTask[task.id] || [],
      resources: resourcesByTask[task.id] || [],
      commentCount: commentCountByTask[task.id] || 0,
    }));

    return NextResponse.json({ success: true, tasks: tasksWithBlockers });
  } catch (error) {
    console.error("GET tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    const {
      user_id,
      user_name,
      title,
      description,
      status,
      project_id,
      category,
      created_week,
      created_year,
      carried_over_from_task_id,
      parent_task_id,
      start_date,
      end_date,
      assigned_to,
      link,
      priority,
      context_type,
      context_id,
      supervisor_id,
      intent_id,
    } = body;

    if (!user_id || !title || !created_week || !created_year) {
      return NextResponse.json(
        {
          success: false,
          error: "user_id, title, created_week, and created_year are required",
        },
        { status: 400 },
      );
    }

    // Phase 1: Inherit project/category from parent task if creating a sub-task
    let finalProjectId = project_id;
    let finalCategory = category;
    if (parent_task_id && !finalProjectId && !finalCategory) {
      try {
        const parentRes = await db.execute({
          sql: "SELECT project_id, category FROM tasks WHERE id = ?",
          args: [parseInt(parent_task_id)],
        });
        if (parentRes.rows.length > 0) {
          const p = parentRes.rows[0];
          if (!finalProjectId && p.project_id)
            finalProjectId = String(p.project_id);
          if (!finalCategory && p.category) finalCategory = p.category;
        }
      } catch (_) {}
    }

    // Task must have project_id OR category — auto-assign "General" as fallback
    if (!finalProjectId && !finalCategory) {
      finalCategory = "General";
    }

    // Prevent task creation on closed projects
    if (finalProjectId) {
      try {
        const projCheck = await db.execute({
          sql: "SELECT status FROM v2_projects WHERE id::text = ?",
          args: [finalProjectId],
        });
        if (
          projCheck.rows.length > 0 &&
          (projCheck.rows[0].status === "Closed" ||
            projCheck.rows[0].status === "Archived")
        ) {
          return NextResponse.json(
            {
              success: false,
              error: "Cannot add tasks to a closed or archived project.",
            },
            { status: 400 },
          );
        }
      } catch (_) {}
    }

    // Phase 5: Auto-generate start_date from created_at if not provided
    // ─── DATE VALIDATION (Phase 13) ───
    if (start_date && !isValidDateStr(start_date)) {
      return NextResponse.json(
        { success: false, error: "Invalid start_date. Expected format YYYY-MM-DD." },
        { status: 400 },
      );
    }
    if (end_date && !isValidDateStr(end_date)) {
      return NextResponse.json(
        { success: false, error: "Invalid end_date. Expected format YYYY-MM-DD." },
        { status: 400 },
      );
    }
    if (start_date && end_date && end_date < start_date) {
      return NextResponse.json(
        { success: false, error: "Due date cannot be earlier than the start date." },
        { status: 400 },
      );
    }
    // New tasks for the current reporting week cannot start in the past
    // (backfilled tasks for previous weeks and subtasks are exempt).
    const isCurrentWeekTask = isCurrentWeek(created_week, created_year);
    if (
      isCurrentWeekTask &&
      !parent_task_id &&
      !carried_over_from_task_id &&
      start_date &&
      start_date < todayStr()
    ) {
      return NextResponse.json(
        { success: false, error: "Start date cannot be in the past." },
        { status: 400 },
      );
    }

    const finalStartDate =
      start_date || (isCurrentWeekTask ? todayStr() : null);
    const finalEndDate = end_date || null;
    let finalAssignedTo = assigned_to || null;

    // If task has a project but no assignee, default to project owner
    if (!finalAssignedTo && finalProjectId) {
      try {
        const ownerRes = await db.execute({
          sql: "SELECT owner_id FROM v2_projects WHERE id::text = ?",
          args: [String(finalProjectId)],
        });
        if (ownerRes.rows.length > 0 && ownerRes.rows[0].owner_id) {
          finalAssignedTo = ownerRes.rows[0].owner_id;
        }
      } catch (_) {}
    }

    // Prevent assigning to super_admin (unless the creator IS the super admin assigning to themselves)
    if (finalAssignedTo) {
      try {
        const saCheck = await db.execute({
          sql: "SELECT role FROM contacts WHERE cid = ? AND role = 'super_admin'",
          args: [finalAssignedTo],
        });
        if (saCheck.rows.length > 0 && finalAssignedTo !== user_id) {
          return NextResponse.json(
            {
              success: false,
              error: "Cannot assign tasks to a Super Admin.",
            },
            { status: 400 },
          );
        }
      } catch (_) {}
    }

    // Phase 2: All Future Studio staff can add tasks to any project — skip membership check
    let finalStatus = status || "in_progress";
    let pendingApproval = false;

    // If assigned to someone else, don't set assigned_to directly — use pending assignment workflow
    const needsAssignment = finalAssignedTo && finalAssignedTo !== user_id;
    const effectiveAssignedTo = needsAssignment ? null : finalAssignedTo;

    // PHASE 2: Contact Group enforcement — assigner and assignee must share a group.
    if (needsAssignment && session.role !== "super_admin") {
      const { validateTaskAssignment } = await import("@/lib/contactGroups");
      const groupCheck = await validateTaskAssignment(
        user_id,
        finalAssignedTo,
        { context_type: context_type || "staff", context_id: context_id || null },
      );
      if (!groupCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot assign task outside your Contact Group. ${groupCheck.reason || "No shared group found."}`,
          },
          { status: 403 },
        );
      }
    }

    const finalPriority = ["critical", "high", "medium", "low"].includes(
      priority,
    )
      ? priority
      : "medium";

    const result = await db.execute({
      sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id, category,
         created_week, created_year, carried_over_from_task_id,
         parent_task_id, start_date, end_date, assigned_to, link, priority,
         context_type, context_id, supervisor_id, intent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?)
         RETURNING id`,
      args: [
        user_id,
        user_name || "",
        title,
        description || null,
        finalStatus,
        finalProjectId || null,
        finalCategory || null,
        created_week,
        created_year,
        carried_over_from_task_id || null,
        parent_task_id || null,
        finalStartDate,
        finalEndDate,
        effectiveAssignedTo,
        link || null,
        finalPriority,
        context_type || "staff",
        context_id || null,
        supervisor_id || null,
        intent_id || null,
      ],
    });

    const taskId = Number(result.rows[0]?.id || result.lastInsertRowid);

    // ─── SUBTASK ⇄ PARENT CASCADE on creation (Phase 13) ───
    // Keep parent/subtask completion consistent:
    //   - All non-archived subtasks complete → parent completes (respecting blockers)
    //   - Any incomplete subtask exists → completed parent reopens to in_progress
    if (parent_task_id) {
      try {
        const incompleteSubs = await db.execute({
          sql: "SELECT COUNT(*) AS total FROM tasks WHERE parent_task_id = ? AND status NOT IN ('completed', 'archived')",
          args: [parseInt(parent_task_id)],
        });
        if ((Number(incompleteSubs.rows[0]?.total) || 0) === 0) {
          const parentBlockerRes = await db.execute({
            sql: "SELECT id FROM blockers WHERE task_id = ? AND status = 'active'",
            args: [parseInt(parent_task_id)],
          });
          if (parentBlockerRes.rows.length === 0) {
            await db.execute({
              sql: `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'archived' AND status != 'completed'`,
              args: [parseInt(parent_task_id)],
            });
          }
        } else {
          await db.execute({
            sql: `UPDATE tasks SET status = 'in_progress', completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'completed'`,
            args: [parseInt(parent_task_id)],
          });
        }
      } catch (_) {}
    }

    // Audit log: Task Created
    await logAuditEvent({
      entity_type: "task",
      entity_id: taskId,
      user_id,
      user_name: user_name || "",
      action: pendingApproval ? "created_pending_approval" : "created",
      details: `Task "${title}" created${pendingApproval ? " (pending project approval)" : ""} (Week ${created_week}, ${created_year})`,
      metadata: {
        title,
        status: finalStatus,
        project_id: finalProjectId,
        category: finalCategory,
        created_week,
        created_year,
      },
    });

    // Immutable task audit trail
    await logTaskEvent({
      task_id: taskId,
      project_id: finalProjectId,
      actor_id: user_id,
      target_user_id: user_id,
      action_type: pendingApproval
        ? ACTION_TYPES.TASK_UPDATED
        : ACTION_TYPES.TASK_CREATED,
      new_state: {
        title,
        status: finalStatus,
        project_id: finalProjectId,
        category: finalCategory,
      },
      description: `Task "${title}" created${pendingApproval ? " (pending project approval)" : ""}`,
    });

    // ─── Notify super admins about new sub-tasks ───
    if (parent_task_id) {
      try {
        // Fetch parent task title
        const parentTitle =
          (await getTaskTitleById(parent_task_id)) || "Unknown";

        // Fetch all super admins
        const saRes = await db.execute({
          sql: "SELECT cid, name FROM contacts WHERE role = 'super_admin' AND status = 'active'",
          args: [],
        });

        for (const sa of saRes.rows) {
          await db.execute({
            sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                  VALUES (?, ?, ?, ?, 0, NOW())`,
            args: [
              sa.cid,
              "New Sub-task Created",
              `${user_name || user_id} added sub-task "${title}" under "${parentTitle}"`,
              "subtask",
            ],
          });
        }
      } catch (_) {}
    }

    // ─── Auto-upsert weekly standup (unified task→standup sync) ───
    try {
      const userRes = await db.execute({
        sql: "SELECT role FROM contacts WHERE cid = ? LIMIT 1",
        args: [user_id],
      });
      const userRole = userRes.rows[0]?.role || "staff";

      await standupUpsert({
        user_id,
        user_name: user_name || "Unknown",
        user_role: userRole,
        week_number: created_week,
        year: created_year,
        taskContext: { title, status: finalStatus },
      });
    } catch (e) {
      console.error("Standup upsert failed (non-blocking):", e.message);
    }

    // ─── Task Assignment Workflow ───
    // If assigned to someone else, create pending assignment (requires accept/decline)
    if (needsAssignment) {
      try {
        await db.execute({
          sql: "INSERT INTO task_assignments (task_id, assigner_id, assignee_id) VALUES (?, ?, ?)",
          args: [taskId, user_id, finalAssignedTo],
        });
        // Notify assignee — resolve display name if not provided
        const taskRef = title || "#" + taskId;
        let notifyName = user_name;
        if (!notifyName) {
          try {
            const nameRes = await db.execute({
              sql: "SELECT name FROM contacts WHERE cid = ?",
              args: [user_id],
            });
            if (nameRes.rows.length > 0) notifyName = nameRes.rows[0].name;
          } catch (_) {}
        }
        await db.execute({
          sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
          args: [
            finalAssignedTo,
            "New Task Assignment",
            `${notifyName || user_id} assigned you task "${taskRef}"`,
            "task_assignment",
          ],
        });
      } catch (e) {
        console.error("Task assignment creation failed:", e.message);
      }
    }

    // ─── Sync parent end_date if subtask extends further ───
    if (parent_task_id && finalEndDate) {
      try {
        const parentEndStr = await getTaskEndDateById(parseInt(parent_task_id));
        if (parentEndStr) {
          const parentEnd = new Date(parentEndStr);
          const subEnd = new Date(finalEndDate);
          if (subEnd > parentEnd) {
            await db.execute({
              sql: "UPDATE tasks SET end_date = ? WHERE id = ?",
              args: [finalEndDate, parseInt(parent_task_id)],
            });
          }
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      id: taskId,
      action: pendingApproval ? "created_pending_approval" : "created",
      pendingApproval,
    });
  } catch (error) {
    console.error("POST tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const body = await req.json();
    const {
      id,
      title,
      description,
      status,
      project_id,
      user_id,
      user_name,
      start_date,
      end_date,
      assigned_to,
      link,
      priority,
      force_complete,
      context_type,
      context_id,
      supervisor_id,
      intent_id,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // Fetch current task state
    const task = await getTaskById(id);

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    // SECURITY (Phase 0/6): Only the task owner, assignee, supervisor, or SA can update.
    const sessionCid = String(session.cid);
    if (
      session.role !== "super_admin" &&
      String(task.user_id) !== sessionCid &&
      String(task.assigned_to || "") !== sessionCid &&
      String(task.supervisor_id || "") !== sessionCid
    ) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to update this task." },
        { status: 403 },
      );
    }

    const locked = await isTaskLocked(id);

    const updateFields = [];
    const updateArgs = [];
    const changes = [];

    // Ownership enforcement: only the task creator or super_admin can change status
    if (link !== undefined && link !== task.link) {
      updateFields.push("link = ?");
      updateArgs.push(link || null);
      changes.push("link updated");
    }
    if (
      priority !== undefined &&
      ["critical", "high", "medium", "low"].includes(priority) &&
      priority !== task.priority
    ) {
      updateFields.push("priority = ?");
      updateArgs.push(priority);
      changes.push(`priority changed to ${priority}`);
    }
    if (status !== undefined && status !== task.status) {
      const effectiveUserId = user_id || session.cid;
      if (
        session.role !== "super_admin" &&
        String(effectiveUserId) !== String(task.user_id) &&
        String(effectiveUserId) !== String(task.assigned_to || "")
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Only the task creator or assignee can change its status.",
          },
          { status: 403 },
        );
      }
    }

    // Phase 6: Locking enforcement
    if (locked) {
      // Title and description cannot be modified when locked
      if (title !== undefined && title !== task.title) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Task is locked (older than 12 hours). Title cannot be modified.",
            locked: true,
          },
          { status: 403 },
        );
      }
      if (description !== undefined && description !== task.description) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Task is locked (older than 12 hours). Description cannot be modified.",
            locked: true,
          },
          { status: 403 },
        );
      }
    }

    // Phase 5/7: Task completion protection
    if (status === "completed") {
      const activeBlockers = await db.execute({
        sql: "SELECT id, title FROM blockers WHERE task_id = ? AND status = 'active'",
        args: [parseInt(id)],
      });

      // Also check blockers on subtasks (Rule 25)
      const subtaskBlockers = await db.execute({
        sql: `SELECT b.id, b.title, b.task_id, t.title AS task_title
              FROM blockers b
              JOIN tasks t ON b.task_id = t.id
              WHERE t.parent_task_id = ? AND b.status = 'active'`,
        args: [parseInt(id)],
      });

      const allBlockers = [
        ...activeBlockers.rows.map((b) => ({ ...b, source: "task" })),
        ...subtaskBlockers.rows.map((b) => ({ ...b, source: "subtask" })),
      ];

      if (allBlockers.length > 0) {
        if (!force_complete) {
          return NextResponse.json({
            success: false,
            error:
              "This task has active blockers. Please confirm completion or resolve the blocker before proceeding.",
            hasActiveBlockers: true,
            blockers: allBlockers,
          });
        }
      }
    }

    let auditAction = "updated";
    let auditDetails = "";
    let needsRescheduleInc = false;
    let dateChangeLog = null; // { field, old_val, new_val } for task_audit_logs

    if (title !== undefined && title !== task.title) {
      updateFields.push("title = ?");
      updateArgs.push(title);
      changes.push(`title changed to "${title}"`);
    }
    if (description !== undefined && description !== task.description) {
      updateFields.push("description = ?");
      updateArgs.push(description);
      changes.push("description updated");
    }
    if (status !== undefined && status !== task.status) {
      updateFields.push("status = ?");
      updateArgs.push(status);

      if (status === "completed") {
        updateFields.push("completed_at = CURRENT_TIMESTAMP");
        auditAction = "completed";
        auditDetails = `Task "${task.title}" marked as completed`;
      } else if (status === "carried_over") {
        auditAction = "carried_over";
        auditDetails = `Task "${task.title}" carried over to next week`;
      } else if (status === "archived") {
        auditAction = "archived";
        auditDetails = `Task "${task.title}" archived`;
      } else {
        auditDetails = `Task "${task.title}" status changed from ${task.status} to ${status}`;
      }
      changes.push(`status changed to ${status}`);
    }
    if (project_id !== undefined) {
      const projectChanged = String(project_id) !== String(task.project_id);
      updateFields.push("project_id = ?");
      updateArgs.push(project_id || null);
      changes.push("project reassigned");

      if (projectChanged && project_id) {
        // Phase 5: Re-validate project assignment on change
        const memberCheck = await db.execute({
          sql: "SELECT id FROM project_members WHERE project_id = ? AND user_cid = ?",
          args: [project_id, user_id || task.user_id],
        });

        if (memberCheck.rows.length === 0) {
          // Staff not assigned — reset to pending approval
          updateFields.push("status = 'pending_project_approval'");
          // Create new approval request
          try {
            await db.execute({
              sql: `INSERT INTO project_approval_requests
                (task_id, requester_id, requester_name, project_id, status)
                VALUES (?, ?, ?, ?, 'pending')`,
              args: [
                parseInt(id),
                user_id || task.user_id,
                user_name || task.user_name || "",
                project_id,
              ],
            });
          } catch (e) {
            console.error(
              "Failed to insert project_approval_request:",
              e.message,
            );
          }
          changes.push("project reassignment requires approval");
        }
      }
    }

    // ── PHASE 1: Context fields ──
    if (context_type !== undefined && context_type !== (task.context_type || null)) {
      updateFields.push("context_type = ?");
      updateArgs.push(context_type || null);
      changes.push(`context_type changed to ${context_type}`);
    }
    if (context_id !== undefined && String(context_id) !== String(task.context_id || "")) {
      updateFields.push("context_id = ?");
      updateArgs.push(context_id || null);
      changes.push(`context_id changed`);
    }
    if (supervisor_id !== undefined && String(supervisor_id) !== String(task.supervisor_id || "")) {
      updateFields.push("supervisor_id = ?");
      updateArgs.push(supervisor_id || null);
      changes.push(`supervisor updated`);
    }
    if (intent_id !== undefined && String(intent_id) !== String(task.intent_id || "")) {
      updateFields.push("intent_id = ?");
      updateArgs.push(intent_id || null);
      changes.push(`intent linked`);
      // Auto-populate supervisor from intent if not explicitly set
      if (intent_id && !supervisor_id && !task.supervisor_id) {
        try {
          const intentRes = await db.execute({
            sql: "SELECT responsible_id FROM intents WHERE id = ?",
            args: [intent_id],
          });
          if (intentRes.rows.length > 0 && intentRes.rows[0].responsible_id) {
            updateFields.push("supervisor_id = ?");
            updateArgs.push(intentRes.rows[0].responsible_id);
            changes.push("supervisor inherited from intent");
          }
        } catch (_) {}
      }
    }

    // ─── ASSIGNMENT MANAGEMENT ───
    let pendingAssignmentCreated = false;
    if (assigned_to !== undefined) {
      const assignmentChanged =
        String(assigned_to) !== String(task.assigned_to || "");
      const effectiveUserId = user_id || session.cid;

      // Un-assign: clear directly (no pending workflow needed)
      if (assignmentChanged && !assigned_to) {
        updateFields.push("assigned_to = ?");
        updateArgs.push(null);
        changes.push("assignment removed");
        auditDetails = `Assignment removed for task "${task.title}"`;
      }
      // Self-assign: set directly (no pending workflow needed)
      else if (
        assignmentChanged &&
        assigned_to &&
        String(assigned_to) === String(effectiveUserId)
      ) {
        updateFields.push("assigned_to = ?");
        updateArgs.push(assigned_to);
        changes.push(`self-assigned`);
        auditDetails = `Task "${task.title}" self-assigned`;
      }
      // Assign to another user: create pending assignment (requires accept/decline)
      else if (assignmentChanged && assigned_to) {
        // PHASE 2: Contact Group enforcement
        if (session.role !== "super_admin") {
          const { validateTaskAssignment } = await import("@/lib/contactGroups");
          const groupCheck = await validateTaskAssignment(
            effectiveUserId,
            assigned_to,
            {
              context_type: task.context_type || "staff",
              context_id: task.context_id || null,
            },
          );
          if (!groupCheck.allowed) {
            return NextResponse.json(
              {
                success: false,
                error: `Cannot assign task outside your Contact Group. ${groupCheck.reason || "No shared group found."}`,
              },
              { status: 403 },
            );
          }
        }

        // Do NOT push assigned_to to updateFields — task stays unassigned until acceptance
        pendingAssignmentCreated = true;
        changes.push(`pending assignment to user ${assigned_to}`);
        auditDetails = `Task "${task.title}" pending assignment to user ${assigned_to}`;

        // Guard against duplicate pending rows
        const dupCheck = await db.execute({
          sql: "SELECT id FROM task_assignments WHERE task_id = ? AND assignee_id = ? AND status = 'pending'",
          args: [parseInt(id), assigned_to],
        });

        if (dupCheck.rows.length === 0) {
          await db.execute({
            sql: "INSERT INTO task_assignments (task_id, assigner_id, assignee_id) VALUES (?, ?, ?)",
            args: [parseInt(id), effectiveUserId, assigned_to],
          });
        }

        // Notify assignee via v2_notifications with richer messaging
        let notifyName = user_name || session.name;
        if (!notifyName) {
          try {
            const nameRes = await db.execute({
              sql: "SELECT name FROM contacts WHERE cid = ?",
              args: [effectiveUserId],
            });
            if (nameRes.rows.length > 0) notifyName = nameRes.rows[0].name;
          } catch (_) {}
        }
        try {
          await db.execute({
            sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
            args: [
              assigned_to,
              "New Task Assignment",
              `${notifyName || effectiveUserId} assigned you task "${task.title}" — please accept or decline this assignment.`,
              "task_assignment",
            ],
          });
        } catch (notifErr) {
          console.error("Assignment notification failed:", notifErr.message);
        }
      }
    }
    // ─── SCHEDULE DRIFT DETECTION (Phase 2/11) ───
    if (start_date !== undefined) {
      const dateChanged = start_date !== (task.start_date || null);
      updateFields.push("start_date = ?");
      updateArgs.push(start_date || null);

      if (dateChanged) {
        dateChangeLog = {
          field: "start_date",
          old_val: task.start_date,
          new_val: start_date,
        };
        changes.push("start date updated");
        // First schedule: immutable once set
        if (!task.first_scheduled_start_date && start_date) {
          updateFields.push("first_scheduled_start_date = ?");
          updateArgs.push(start_date);
          changes.push("first schedule captured");
        } else if (
          task.first_scheduled_start_date &&
          start_date !== task.first_scheduled_start_date
        ) {
          // Drift detected — increment reschedule count via separate update
          needsRescheduleInc = true;
          changes.push("schedule drift detected");
        }
      }
    }
    if (end_date !== undefined) {
      const dateChanged = end_date !== (task.end_date || null);
      updateFields.push("end_date = ?");
      updateArgs.push(end_date || null);

      if (dateChanged) {
        dateChangeLog = {
          field: "end_date",
          old_val: task.end_date,
          new_val: end_date,
        };
        changes.push("end date updated");
        // First schedule: immutable once set
        if (!task.first_scheduled_end_date && end_date) {
          updateFields.push("first_scheduled_end_date = ?");
          updateArgs.push(end_date);
          changes.push("first schedule captured");
        } else if (
          task.first_scheduled_end_date &&
          end_date !== task.first_scheduled_end_date
        ) {
          // Drift detected — increment reschedule count via separate update
          needsRescheduleInc = true;
          changes.push("schedule drift detected");
        }
      }
    }

    // ─── DATE VALIDATION (Phase 13) ───
    if (start_date !== undefined && start_date && !isValidDateStr(start_date)) {
      return NextResponse.json(
        { success: false, error: "Invalid start_date. Expected format YYYY-MM-DD." },
        { status: 400 },
      );
    }
    if (end_date !== undefined && end_date && !isValidDateStr(end_date)) {
      return NextResponse.json(
        { success: false, error: "Invalid end_date. Expected format YYYY-MM-DD." },
        { status: 400 },
      );
    }
    const effStartDate =
      start_date !== undefined ? start_date || null : task.start_date;
    const effEndDate = end_date !== undefined ? end_date || null : task.end_date;
    if (effStartDate && effEndDate && effEndDate < effStartDate) {
      return NextResponse.json(
        { success: false, error: "Due date cannot be earlier than the start date." },
        { status: 400 },
      );
    }

    if (updateFields.length === 0 && !pendingAssignmentCreated) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    if (updateFields.length === 0 && pendingAssignmentCreated) {
      return NextResponse.json({
        success: true,
        message: "Pending assignment created",
      });
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateArgs.push(parseInt(id));

    await db.execute({
      sql: `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`,
      args: updateArgs,
    });

    // ─── Sync parent end_date if subtask extends further ───
    if (task.parent_task_id && end_date !== undefined) {
      try {
        const parentEndRes = await db.execute({
          sql: "SELECT end_date FROM tasks WHERE id = ?",
          args: [parseInt(task.parent_task_id)],
        });
        if (parentEndRes.rows.length > 0) {
          const subEnd = new Date(end_date || task.end_date);
          const currentParentEndStr = parentEndRes.rows[0].end_date;
          let shouldUpdateParent = false;

          if (!currentParentEndStr) {
            shouldUpdateParent = true;
          } else {
            const parentEnd = new Date(currentParentEndStr);
            if (subEnd > parentEnd) {
              shouldUpdateParent = true;
            }
          }

          if (shouldUpdateParent) {
            await db.execute({
              sql: "UPDATE tasks SET end_date = ? WHERE id = ?",
              args: [end_date || task.end_date, parseInt(task.parent_task_id)],
            });
          }
        }
      } catch (_) {}
    }

    // ─── Auto-complete sub-tasks when parent is completed ───
    if (status === "completed" && status !== task.status) {
      try {
        const updatedSubs = await db.execute({
          sql: `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE parent_task_id = ? AND status != 'completed' AND status != 'archived'`,
          args: [parseInt(id)],
        });

        // Notify super admins when sub-tasks are auto-completed
        if (updatedSubs.rowsAffected > 0) {
          const saRes = await db.execute({
            sql: "SELECT cid FROM contacts WHERE role = 'super_admin' AND status = 'active'",
            args: [],
          });
          for (const sa of saRes.rows) {
            await db.execute({
              sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                    VALUES (?, ?, ?, ?, 0, NOW())`,
              args: [
                sa.cid,
                "Sub-tasks Auto-completed",
                `Sub-tasks for task "${task.title}" were auto-completed by completing the parent task.`,
                "subtask_auto_complete",
              ],
            });
          }
        }
      } catch (_) {}

      // ─── Walk carryover chain backwards and mark ancestors as completed ───
      // When a cloned task is completed, its originals (carried_over status)
      // should also be marked completed so they stop appearing in carryover.
      await completeCarryoverAncestors(id);
    }

    // ─── SUBTASK ⇄ PARENT CASCADE (Phase 13) ───
    // Keep parent/subtask completion consistent:
    //   - All non-archived subtasks complete → parent completes (respecting blockers)
    //   - Any incomplete subtask exists → completed parent reopens to in_progress
    if (task.parent_task_id) {
      try {
        const incompleteSubs = await db.execute({
          sql: "SELECT COUNT(*) AS total FROM tasks WHERE parent_task_id = ? AND status NOT IN ('completed', 'archived')",
          args: [parseInt(task.parent_task_id)],
        });
        if ((Number(incompleteSubs.rows[0]?.total) || 0) === 0) {
          // All subtasks complete → auto-complete the parent (unless it has active blockers)
          const parentBlockerRes = await db.execute({
            sql: "SELECT id FROM blockers WHERE task_id = ? AND status = 'active'",
            args: [parseInt(task.parent_task_id)],
          });
          if (parentBlockerRes.rows.length === 0) {
            const parentRes = await db.execute({
              sql: `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'archived' AND status != 'completed'`,
              args: [parseInt(task.parent_task_id)],
            });
            if (parentRes.rowsAffected > 0) {
              try {
                const pTitle =
                  (await getTaskTitleById(task.parent_task_id)) ||
                  `Task #${task.parent_task_id}`;
                await logAuditEvent({
                  entity_type: "task",
                  entity_id: parseInt(task.parent_task_id),
                  user_id: user_id || task.user_id,
                  user_name: user_name || task.user_name,
                  action: "completed",
                  details: `Parent task "${pTitle}" auto-completed (all subtasks completed)`,
                  metadata: { status: "completed", auto: true },
                });
              } catch (_) {}
            }
          }
        } else {
          // Some subtasks incomplete → reopen parent if it was completed
          await db.execute({
            sql: `UPDATE tasks SET status = 'in_progress', completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'completed'`,
            args: [parseInt(task.parent_task_id)],
          });
        }
      } catch (_) {}
    }

    // Reopening a parent task reopens its completed subtasks (keeps state consistent)
    if (
      !task.parent_task_id &&
      status !== undefined &&
      status !== task.status &&
      task.status === "completed" &&
      status !== "completed" &&
      status !== "archived" &&
      status !== "carried_over"
    ) {
      try {
        await db.execute({
          sql: `UPDATE tasks SET status = 'in_progress', completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE parent_task_id = ? AND status = 'completed'`,
          args: [parseInt(id)],
        });
      } catch (_) {}
    }

    // ─── Log assignment event to task_assignment_log ───
    if (assigned_to !== undefined) {
      const assignmentChanged =
        String(assigned_to) !== String(task.assigned_to || "");
      if (assignmentChanged) {
        const effectiveUserId = user_id || session.cid;
        const isPendingAssignment =
          assigned_to && String(assigned_to) !== String(effectiveUserId);
        await logTaskEvent({
          task_id: parseInt(id),
          project_id: project_id || task.project_id,
          actor_id: user_id || task.user_id,
          target_user_id: assigned_to || null,
          action_type: assigned_to
            ? ACTION_TYPES.TASK_ASSIGNED
            : ACTION_TYPES.TASK_UPDATED,
          previous_state: { assigned_to: task.assigned_to },
          // Pending assignment: tasks.assigned_to stays NULL until acceptance
          new_state: {
            assigned_to: isPendingAssignment ? null : assigned_to || null,
          },
          description: isPendingAssignment
            ? `Pending assignment to ${assigned_to} (awaiting acceptance)`
            : assigned_to
              ? `Task assigned to ${assigned_to}`
              : `Assignment removed from task`,
        });
      }
    }

    // SECURITY: Status changes (complete, carry-over) are allowed for collaborative workflows
    // Only block metadata changes (title, description, project) by non-owners
    const isTaskOwner = String(task.user_id) === String(session.cid);
    const isAssignee =
      task.assigned_to && String(task.assigned_to) === String(session.cid);
    const isOnlyStatusChange =
      Object.keys(body).filter(
        (k) => k !== "id" && k !== "status" && k !== "force_complete",
      ).length === 0;
    if (
      session.role !== "super_admin" &&
      !isTaskOwner &&
      !isAssignee &&
      !isOnlyStatusChange
    ) {
      return NextResponse.json(
        { success: false, error: "You can only update your own tasks." },
        { status: 403 },
      );
    }

    // ─── Reschedule increment (Phase 2/11) ───
    if (needsRescheduleInc) {
      await db.execute({
        sql: "UPDATE tasks SET reschedule_count = COALESCE(reschedule_count, 0) + 1 WHERE id = ?",
        args: [parseInt(id)],
      });
    }

    // ─── Task audit log for date changes (Phase 11) ───
    if (dateChangeLog) {
      await db.execute({
        sql: `INSERT INTO task_audit_logs
          (task_id, user_id, action, field_name, old_value, new_value, metadata)
          VALUES (?, ?, 'schedule_changed', ?, ?, ?, ?)`,
        args: [
          parseInt(id),
          user_id || task.user_id,
          dateChangeLog.field,
          String(dateChangeLog.old_val || ""),
          String(dateChangeLog.new_val || ""),
          needsRescheduleInc
            ? JSON.stringify({
                drift: true,
                reschedule_count_incremented: true,
              })
            : null,
        ],
      });
    }

    // Audit log
    await logAuditEvent({
      entity_type: "task",
      entity_id: parseInt(id),
      user_id: user_id || task.user_id,
      user_name: user_name || task.user_name,
      action: auditAction,
      details: auditDetails || changes.join("; "),
      metadata: {
        title: title || task.title,
        status: status || task.status,
        project_id: project_id || task.project_id,
      },
    });

    // Immutable task audit trail
    if (status !== undefined && status !== task.status) {
      const actionType =
        status === "completed"
          ? ACTION_TYPES.TASK_COMPLETED
          : status === "carried_over"
            ? ACTION_TYPES.TASK_CARRIED_OVER
            : status === "archived"
              ? ACTION_TYPES.TASK_UPDATED
              : ACTION_TYPES.TASK_UPDATED;
      await logTaskEvent({
        task_id: parseInt(id),
        project_id: project_id || task.project_id,
        actor_id: user_id || task.user_id,
        target_user_id: user_id || task.user_id,
        action_type: actionType,
        previous_state: { status: task.status },
        new_state: { status, title: title || task.title },
        description: `Task status changed from ${task.status} to ${status}`,
      });
    }

    // ─── Rebuild standup task list after task update ───
    if (status !== undefined || title !== undefined) {
      try {
        const { rebuildStandupTasks } = await import("@/lib/standupUpsert");
        await rebuildStandupTasks(
          task.user_id,
          task.created_week,
          task.created_year,
        );
      } catch (e) {
        console.error("Standup rebuild failed (non-blocking):", e.message);
      }
    }

    // ─── Sync parent end_date if this (sub)task extends further ───
    if (
      task.parent_task_id &&
      (end_date !== undefined || start_date !== undefined)
    ) {
      try {
        const effEnd = end_date || task.end_date;
        if (effEnd) {
          const pEndStr = await getTaskEndDateById(task.parent_task_id);
          if (pEndStr) {
            const pEnd = new Date(pEndStr);
            const sEnd = new Date(effEnd);
            if (sEnd > pEnd) {
              await db.execute({
                sql: "UPDATE tasks SET end_date = ? WHERE id = ?",
                args: [effEnd, task.parent_task_id],
              });
            }
          }
        }
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      id: parseInt(id),
      action: "updated",
      locked,
    });
  } catch (error) {
    console.error("PUT tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id query parameter is required" },
        { status: 400 },
      );
    }

    // SECURITY (Phase 0/6): Only the task owner, assignee, supervisor, or SA can delete
    const taskCheck = await db.execute({
      sql: "SELECT user_id, assigned_to, supervisor_id, title, status FROM tasks WHERE id = ?",
      args: [parseInt(id)],
    });
    if (taskCheck.rows.length > 0) {
      const taskRow = taskCheck.rows[0];
      if (
        session.role !== "super_admin" &&
        String(taskRow.user_id) !== String(session.cid) &&
        String(taskRow.assigned_to || "") !== String(session.cid) &&
        String(taskRow.supervisor_id || "") !== String(session.cid)
      ) {
        return NextResponse.json(
          { success: false, error: "You can only delete your own tasks, assigned tasks, or supervised tasks." },
          { status: 403 },
        );
      }
    }

    // Phase 6: Locking enforcement - locked tasks cannot be deleted
    const locked = await isTaskLocked(id);
    if (locked) {
      return NextResponse.json(
        {
          success: false,
          error: "Task is locked (older than 12 hours) and cannot be deleted.",
          locked: true,
        },
        { status: 403 },
      );
    }

    // Carry-over tasks cannot be deleted (standup commitment rule)
    if (
      taskCheck.rows.length > 0 &&
      taskCheck.rows[0].status === "carried_over"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Carry-over tasks cannot be deleted. They must be completed or resolved.",
        },
        { status: 403 },
      );
    }

    // Get task info before deleting (need all fields for standup rebuild)
    const taskInfo = await db.execute({
      sql: "SELECT title, user_id, user_name, created_week, created_year FROM tasks WHERE id = ?",
      args: [parseInt(id)],
    });

    // Delete associated blockers, subtasks, and audit logs first
    await db.execute({
      sql: "DELETE FROM blockers WHERE task_id IN (SELECT id FROM tasks WHERE id = ? OR parent_task_id = ?)",
      args: [parseInt(id), parseInt(id)],
    });

    // Delete subtasks first (parent_task_id pointing to this task)
    await db.execute({
      sql: "DELETE FROM tasks WHERE parent_task_id = ?",
      args: [parseInt(id)],
    });

    await db.execute({
      sql: "DELETE FROM tasks WHERE id = ?",
      args: [parseInt(id)],
    });

    if (taskInfo.rows.length > 0) {
      const task = taskInfo.rows[0];
      // Audit log
      await logAuditEvent({
        entity_type: "task",
        entity_id: parseInt(id),
        user_id: session.cid || task.user_id,
        user_name: session.name || task.user_name,
        action: "deleted",
        details: `Task "${task.title}" deleted`,
        metadata: { title: task.title },
      });

      // ─── Rebuild standup after task deletion ───
      try {
        const { rebuildStandupTasks } = await import("@/lib/standupUpsert");
        await rebuildStandupTasks(
          task.user_id,
          task.created_week,
          task.created_year,
        );
      } catch (e) {
        console.error("Standup rebuild failed (non-blocking):", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      action: "deleted",
    });
  } catch (error) {
    console.error("DELETE tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/tasks
 *
 * Accept or decline a pending task assignment.
 * Body: { action: "accept" | "decline", task_assignment_id?: number, task_id?: number }
 *
 * If task_assignment_id is provided, it looks up that specific record.
 * Otherwise, it uses task_id + the authenticated user's session cid.
 */
export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const body = await req.json();
    const { action, task_assignment_id, task_id } = body;

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid action ('accept' or 'decline') is required.",
        },
        { status: 400 },
      );
    }

    if (!task_assignment_id && !task_id) {
      return NextResponse.json(
        {
          success: false,
          error: "task_assignment_id or task_id is required.",
        },
        { status: 400 },
      );
    }

    // Look up pending assignment
    let assignment;
    if (task_assignment_id) {
      const res = await db.execute({
        sql: "SELECT * FROM task_assignments WHERE id = ? AND status = 'pending'",
        args: [parseInt(task_assignment_id)],
      });
      assignment = res.rows[0];
    } else {
      const res = await db.execute({
        sql: "SELECT * FROM task_assignments WHERE task_id = ? AND assignee_id = ? AND status = 'pending'",
        args: [parseInt(task_id), session.cid],
      });
      assignment = res.rows[0];
    }

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "No pending assignment found." },
        { status: 404 },
      );
    }

    // Only the assignee can accept or decline
    if (String(assignment.assignee_id) !== String(session.cid)) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only respond to your own assignments.",
        },
        { status: 403 },
      );
    }

    const newStatus = action === "accept" ? "accepted" : "declined";

    // Update the assignment status
    await db.execute({
      sql: "UPDATE task_assignments SET status = ? WHERE id = ?",
      args: [newStatus, assignment.id],
    });

    // If accepted, assign the task to the user
    if (action === "accept") {
      await db.execute({
        sql: "UPDATE tasks SET assigned_to = ? WHERE id = ?",
        args: [assignment.assignee_id, assignment.task_id],
      });
    }

    // Fetch task title for notifications and audit
    let taskTitle = `Task #${assignment.task_id}`;
    try {
      const taskRes = await db.execute({
        sql: "SELECT title FROM tasks WHERE id = ?",
        args: [assignment.task_id],
      });
      if (taskRes.rows.length > 0) {
        taskTitle = taskRes.rows[0].title;
      }
    } catch (_) {}

    // Notify the original assigner
    const notificationTitle =
      action === "accept"
        ? "Task Assignment Accepted"
        : "Task Assignment Declined";
    const notificationMessage =
      action === "accept"
        ? `${session.name || session.cid} accepted your assignment for task "${taskTitle}"`
        : `${session.name || session.cid} declined your assignment for task "${taskTitle}"`;

    try {
      await db.execute({
        sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
        args: [
          assignment.assigner_id,
          notificationTitle,
          notificationMessage,
          "task_assignment",
        ],
      });
    } catch (notifErr) {
      console.error(
        "Assignment response notification failed:",
        notifErr.message,
      );
    }

    // Audit log
    await logAuditEvent({
      entity_type: "task",
      entity_id: assignment.task_id,
      user_id: session.cid,
      user_name: session.name || "",
      action:
        action === "accept"
          ? "assignment_accepted"
          : "assignment_declined",
      details: `Task "${taskTitle}" assignment ${action === "accept" ? "accepted" : "declined"} by ${session.name || session.cid}`,
      metadata: {
        task_id: assignment.task_id,
        assigner_id: assignment.assigner_id,
      },
    });

    return NextResponse.json({ success: true, action: newStatus });
  } catch (error) {
    console.error("PATCH tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
