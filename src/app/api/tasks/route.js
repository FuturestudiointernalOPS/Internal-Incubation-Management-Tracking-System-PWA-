import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logAuditEvent, isTaskLocked } from "@/lib/audit";

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
    const sort = searchParams.get("sort");

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

    const result = await db.execute({ sql, args });

    // For each task, fetch linked blockers
    const tasksWithBlockers = await Promise.all(
      result.rows.map(async (task) => {
        const blockerRes = await db.execute({
          sql: "SELECT id, title, status, severity FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
          args: [task.id],
        });
        return { ...task, blockers: blockerRes.rows || [] };
      }),
    );

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
      created_week,
      created_year,
      carried_over_from_task_id,
      start_date,
      end_date,
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

    const result = await db.execute({
      sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id,
         created_week, created_year, carried_over_from_task_id,
         start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        user_id,
        user_name || "",
        title,
        description || null,
        status || "pending",
        project_id || null,
        created_week,
        created_year,
        carried_over_from_task_id || null,
        start_date || null,
        end_date || null,
      ],
    });

    const taskId = Number(result.lastInsertRowid);

    // Audit log: Task Created
    await logAuditEvent({
      entity_type: "task",
      entity_id: taskId,
      user_id,
      user_name: user_name || "",
      action: "created",
      details: `Task "${title}" created (Week ${created_week}, ${created_year})`,
      metadata: {
        title,
        status: status || "pending",
        project_id,
        created_week,
        created_year,
      },
    });

    return NextResponse.json({
      success: true,
      id: taskId,
      action: "created",
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
      updateFields.push("project_id = ?");
      updateArgs.push(project_id || null);
      changes.push("project reassigned");
    }
    if (start_date !== undefined) {
      updateFields.push("start_date = ?");
      updateArgs.push(start_date || null);
      changes.push("start date updated");
    }
    if (end_date !== undefined) {
      updateFields.push("end_date = ?");
      updateArgs.push(end_date || null);
      changes.push("end date updated");
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
