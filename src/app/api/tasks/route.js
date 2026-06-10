import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent, isTaskLocked } from "@/lib/audit";
import { logTaskEvent, ACTION_TYPES } from "@/lib/taskAudit";

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

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");
    const status = searchParams.get("status");
    const week_number = searchParams.get("week");
    const year = searchParams.get("year");
    const role = searchParams.get("role");
    const id = searchParams.get("id");
    const assigned_to = searchParams.get("assigned_to");
    const project_id_filter = searchParams.get("project_id");
    const sort = searchParams.get("sort");
    const limit = searchParams.get("limit");
    const brief = searchParams.get("brief") === "true";

    let sql = "SELECT * FROM tasks WHERE 1=1";
    const args = [];

    if (id) {
      sql += " AND id = ?";
      args.push(parseInt(id));
    }

    if (user_id) {
      sql += " AND user_id = ?";
      args.push(user_id);
    }

    if (assigned_to) {
      sql += " AND assigned_to = ?";
      args.push(assigned_to);
    }

    if (project_id_filter) {
      sql += " AND project_id::text = ?";
      args.push(project_id_filter);
    }

    if (status) {
      sql += " AND status = ?";
      args.push(status);
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

    if (taskIds.length > 0) {
      // Single batch query for all blockers
      const blockerRes = await db.execute({
        sql: `SELECT id, title, status, severity, task_id FROM blockers WHERE task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at DESC`,
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
        });
      }

      // Single batch query for all subtasks
      try {
        const subtaskRes = await db.execute({
          sql: `SELECT id, title, status, parent_task_id FROM tasks WHERE parent_task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at ASC`,
          args: taskIds,
        });
        for (const s of subtaskRes.rows || []) {
          const pid = s.parent_task_id;
          if (!subtasksByTask[pid]) subtasksByTask[pid] = [];
          subtasksByTask[pid].push({
            id: s.id,
            title: s.title,
            status: s.status,
          });
        }
      } catch (e) {
        // parent_task_id column may not exist yet
      }
    }

    // Map results
    const tasksWithBlockers = result.rows.map((task) => ({
      ...task,
      blockers: blockersByTask[task.id] || [],
      subtasks: subtasksByTask[task.id] || [],
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
      start_date,
      end_date,
      assigned_to,
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

    // Phase 1: Task must have project_id OR category (not both empty)
    if (!project_id && !category) {
      return NextResponse.json(
        {
          success: false,
          error: "Task must be linked to a project or have a category.",
        },
        { status: 400 },
      );
    }

    // Phase 5: Auto-generate start_date from created_at if not provided
    const finalStartDate = start_date || new Date().toISOString().split("T")[0];
    const finalEndDate = end_date || null;
    const finalAssignedTo = assigned_to || null;

    // If task has a project but no assignee, default to project owner
    if (!finalAssignedTo && project_id) {
      try {
        const ownerRes = await db.execute({
          sql: "SELECT owner_id FROM v2_projects WHERE id::text = ?",
          args: [String(project_id)],
        });
        if (ownerRes.rows.length > 0 && ownerRes.rows[0].owner_id) {
          finalAssignedTo = ownerRes.rows[0].owner_id;
        }
      } catch (_) {}
    }

    // Phase 2: Check project assignment if project_id provided
    let finalStatus = status || "in_progress";
    let pendingApproval = false;

    if (project_id) {
      const memberCheck = await db.execute({
        sql: "SELECT id FROM project_members WHERE project_id = ? AND user_cid = ?",
        args: [parseInt(project_id), user_id],
      });

      if (memberCheck.rows.length === 0) {
        // Staff not assigned to this project — flag for approval
        finalStatus = "pending_project_approval";
        pendingApproval = true;
      }
    }

    const result = await db.execute({
      sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id, category,
         created_week, created_year, carried_over_from_task_id,
         start_date, end_date, assigned_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        user_id,
        user_name || "",
        title,
        description || null,
        finalStatus,
        project_id || null,
        category || null,
        created_week,
        created_year,
        carried_over_from_task_id || null,
        finalStartDate,
        finalEndDate,
        finalAssignedTo,
      ],
    });

    const taskId = Number(result.lastInsertRowid);

    // Phase 2: Create approval request + notification if pending
    if (pendingApproval && project_id) {
      // Create approval request record
      await db.execute({
        sql: `INSERT INTO project_approval_requests
          (task_id, requester_id, requester_name, project_id, status)
          VALUES (?, ?, ?, ?, 'pending')`,
        args: [taskId, user_id, user_name || "", parseInt(project_id)],
      });

      // Notify project owner (or Super Admin as fallback)
      try {
        const projectInfo = await db.execute({
          sql: "SELECT name, owner_id FROM v2_projects WHERE id = ?",
          args: [parseInt(project_id)],
        });
        const projectName =
          projectInfo.rows[0]?.name || `Project #${project_id}`;
        const ownerId = projectInfo.rows[0]?.owner_id || "sa";

        await fetch(new URL("/api/notifications", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_id: ownerId,
            title: "Project Contribution Request",
            message: `${user_name || user_id} wants to link task "${title}" to "${projectName}". Please review and approve.`,
            type: "approval",
          }),
        });
      } catch (notifErr) {
        console.error(
          "Failed to send approval notification:",
          notifErr.message,
        );
      }
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
        project_id,
        category,
        created_week,
        created_year,
      },
    });

    // Immutable task audit trail
    await logTaskEvent({
      task_id: taskId,
      project_id,
      actor_id: user_id,
      target_user_id: user_id,
      action_type: pendingApproval
        ? ACTION_TYPES.TASK_UPDATED
        : ACTION_TYPES.TASK_CREATED,
      new_state: { title, status: finalStatus, project_id, category },
      description: `Task "${title}" created${pendingApproval ? " (pending project approval)" : ""}`,
    });

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
      force_complete,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // Fetch current task state
    const currentTask = await db.execute({
      sql: "SELECT * FROM tasks WHERE id = ?",
      args: [parseInt(id)],
    });

    if (currentTask.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    const task = currentTask.rows[0];
    const locked = await isTaskLocked(id);

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

      if (activeBlockers.rows.length > 0) {
        const body2 = await req.json();
        if (!body2.force_complete) {
          return NextResponse.json({
            success: false,
            error:
              "This task has active blockers. Please confirm completion or resolve the blocker before proceeding.",
            hasActiveBlockers: true,
            blockers: activeBlockers.rows,
          });
        }
      }
    }

    const updateFields = [];
    const updateArgs = [];
    let auditAction = "updated";
    let auditDetails = "";
    const changes = [];
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
          args: [parseInt(project_id), user_id || task.user_id],
        });

        if (memberCheck.rows.length === 0) {
          // Staff not assigned — reset to pending approval
          updateFields.push("status = 'pending_project_approval'");
          // Create new approval request
          await db.execute({
            sql: `INSERT INTO project_approval_requests
              (task_id, requester_id, requester_name, project_id, status)
              VALUES (?, ?, ?, ?, 'pending')`,
            args: [
              parseInt(id),
              user_id || task.user_id,
              user_name || task.user_name || "",
              parseInt(project_id),
            ],
          });
          changes.push("project reassignment requires approval");
        }
      }
    }

    // ─── ASSIGNMENT MANAGEMENT ───
    if (assigned_to !== undefined) {
      const assignmentChanged =
        String(assigned_to) !== String(task.assigned_to || "");
      updateFields.push("assigned_to = ?");
      updateArgs.push(assigned_to || null);

      if (assignmentChanged && assigned_to) {
        changes.push(`assigned to user ${assigned_to}`);
        auditDetails = `Task "${task.title}" assigned to user ${assigned_to}`;

        // Get assignee name for notification
        let assigneeName = assigned_to;
        try {
          const assigneeRes = await db.execute({
            sql: "SELECT name FROM contacts WHERE cid = ? OR id = ?",
            args: [assigned_to, assigned_to],
          });
          if (assigneeRes.rows.length > 0) {
            assigneeName = assigneeRes.rows[0].name;
          }
        } catch (_) {}

        // Send notification to assignee
        try {
          const notifUrl = new URL("/api/notifications", req.url).toString();
          await fetch(notifUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient_id: assigned_to,
              title: "Task Assigned",
              message: `${user_name || "Someone"} assigned you "${task.title}". Please review and accept.`,
              type: "assignment",
            }),
          });
        } catch (notifErr) {
          console.error("Assignment notification failed:", notifErr.message);
        }
      } else if (assignmentChanged && !assigned_to) {
        changes.push("assignment removed");
        auditDetails = `Assignment removed for task "${task.title}"`;
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

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateArgs.push(parseInt(id));

    await db.execute({
      sql: `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`,
      args: updateArgs,
    });

    // ─── Log assignment event to task_assignment_log ───
    if (assigned_to !== undefined) {
      const assignmentChanged =
        String(assigned_to) !== String(task.assigned_to || "");
      if (assignmentChanged) {
        await logTaskEvent({
          task_id: parseInt(id),
          project_id: project_id || task.project_id,
          actor_id: user_id || task.user_id,
          target_user_id: assigned_to || null,
          action_type: assigned_to
            ? ACTION_TYPES.TASK_ASSIGNED
            : ACTION_TYPES.TASK_UPDATED,
          previous_state: { assigned_to: task.assigned_to },
          new_state: { assigned_to: assigned_to || null },
          description: assigned_to
            ? `Task assigned to ${assigned_to}`
            : `Assignment removed from task`,
        });
      }
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
          (task_id, user_id, user_name, action, field_name, old_value, new_value, metadata)
          VALUES (?, ?, ?, 'schedule_changed', ?, ?, ?, ?)`,
        args: [
          parseInt(id),
          user_id || task.user_id,
          user_name || task.user_name || "",
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const user_id = searchParams.get("user_id");
    const user_name = searchParams.get("user_name");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id query parameter is required" },
        { status: 400 },
      );
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
    const taskCheck = await db.execute({
      sql: "SELECT status FROM tasks WHERE id = ?",
      args: [parseInt(id)],
    });
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

    // Get task info before deleting
    const taskInfo = await db.execute({
      sql: "SELECT title, user_id, user_name FROM tasks WHERE id = ?",
      args: [parseInt(id)],
    });

    // Delete associated blockers and audit logs first
    await db.execute({
      sql: "DELETE FROM blockers WHERE task_id = ?",
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
        user_id: user_id || task.user_id,
        user_name: user_name || task.user_name,
        action: "deleted",
        details: `Task "${task.title}" deleted`,
        metadata: { title: task.title },
      });
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
