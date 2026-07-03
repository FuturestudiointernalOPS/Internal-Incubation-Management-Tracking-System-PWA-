import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { standupUpsert } from "@/lib/standupUpsert";

/**
 * GET  /api/tasks/assignments?assignee_id=X&status=pending
 * POST /api/tasks/assignments/respond  { assignment_id, action: "accept"|"decline" }
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const assignee_id = searchParams.get("assignee_id");
    const status = searchParams.get("status") || "pending";

    let sql =
      "SELECT ta.*, t.title as task_title, t.project_id, c.name AS assigner_name FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id LEFT JOIN contacts c ON c.cid = ta.assigner_id WHERE 1=1";
    const args = [];
    if (assignee_id) {
      sql += " AND ta.assignee_id = ?";
      args.push(assignee_id);
    }
    if (status) {
      sql += " AND ta.status = ?";
      args.push(status);
    }
    sql += " ORDER BY ta.created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, assignments: result.rows });
  } catch (error) {
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
    const session = await getSession();
    const { assignment_id, action, new_assignee_id } = await req.json();

    if (!assignment_id || !action) {
      return NextResponse.json(
        { success: false, error: "assignment_id and action required" },
        { status: 400 },
      );
    }

    const inv = await db.execute({
      sql: "SELECT * FROM task_assignments WHERE id = ?",
      args: [parseInt(assignment_id)],
    });
    if (inv.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 },
      );
    }
    const a = inv.rows[0];

    // Accept/decline only valid for pending assignments
    if (action !== "reassign" && a.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Assignment no longer pending" },
        { status: 400 },
      );
    }

    const userCid = session.cid;

    // Reassign: only assigner or super_admin may act
    if (action === "reassign") {
      if (!new_assignee_id) {
        return NextResponse.json(
          { success: false, error: "new_assignee_id required for reassign" },
          { status: 400 },
        );
      }
      if (session.role !== "super_admin" && a.assigner_id !== userCid) {
        return NextResponse.json(
          { success: false, error: "Only the assigner can reassign" },
          { status: 403 },
        );
      }
    } else {
      // Accept/decline: only the assignee can respond
      if (a.assignee_id !== userCid) {
        return NextResponse.json(
          { success: false, error: "Only the assignee can respond" },
          { status: 403 },
        );
      }
    }

    // Get task info
    const taskRes = await db.execute({
      sql: "SELECT title, project_id, created_week, created_year FROM tasks WHERE id = ?",
      args: [a.task_id],
    });
    const task = taskRes.rows[0];

    if (action === "decline") {
      await db.execute({
        sql: "UPDATE task_assignments SET status = 'declined', responded_at = NOW() WHERE id = ?",
        args: [parseInt(assignment_id)],
      });
      // Notify assigner
      await db.execute({
        sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
        args: [
          a.assigner_id,
          "Assignment Declined",
          `${session.name || userCid} declined task "${task?.title || "#" + a.task_id}"`,
          "task_assignment",
        ],
      });
      return NextResponse.json({ success: true, action: "declined" });
    }

    if (action === "accept") {
      await db.execute({
        sql: "UPDATE task_assignments SET status = 'accepted', responded_at = NOW() WHERE id = ?",
        args: [parseInt(assignment_id)],
      });

      // Update task's assigned_to
      await db.execute({
        sql: "UPDATE tasks SET assigned_to = ? WHERE id = ?",
        args: [a.assignee_id, a.task_id],
      });

      // Sync to assignee's standup
      if (task) {
        const contactRes = await db.execute({
          sql: "SELECT name, role FROM contacts WHERE cid = ? LIMIT 1",
          args: [a.assignee_id],
        });
        const contact = contactRes.rows[0] || {};
        try {
          await standupUpsert({
            user_id: a.assignee_id,
            user_name: contact.name || a.assignee_id,
            user_role: contact.role || "staff",
            week_number: task.created_week || 0,
            year: task.created_year || 0,
            taskContext: { title: task.title, status: "in_progress" },
          });
        } catch (_) {}
      }

      // Notify assigner
      await db.execute({
        sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
        args: [
          a.assigner_id,
          "Assignment Accepted",
          `${session.name || userCid} accepted task "${task?.title || "#" + a.task_id}"`,
          "task_assignment",
        ],
      });

      return NextResponse.json({ success: true, action: "accepted" });
    }

    if (action === "reassign") {
      // Permission already checked above — only assigner/super_admin reaches here

      // If old assignment was pending, mark it declined so it drops from old assignee's list
      if (a.status === "pending") {
        await db.execute({
          sql: "UPDATE task_assignments SET status = 'declined', responded_at = NOW() WHERE id = ?",
          args: [parseInt(assignment_id)],
        });
      }

      // If old assignment was already accepted, clear tasks.assigned_to back to NULL
      if (a.status === "accepted") {
        await db.execute({
          sql: "UPDATE tasks SET assigned_to = NULL WHERE id = ?",
          args: [a.task_id],
        });
      }

      // Insert new pending row for the new assignee
      await db.execute({
        sql: "INSERT INTO task_assignments (task_id, assigner_id, assignee_id) VALUES (?, ?, ?)",
        args: [a.task_id, userCid, new_assignee_id],
      });

      // Notify new assignee
      await db.execute({
        sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
        args: [
          new_assignee_id,
          "New Task Assignment",
          `${session.name || userCid} reassigned you task "${task?.title || "#" + a.task_id}"`,
          "task_assignment",
        ],
      });

      return NextResponse.json({ success: true, action: "reassigned" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("POST assignments error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
