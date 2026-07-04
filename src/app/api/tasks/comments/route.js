import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { taskExists } from "@/lib/db/queries/tasks";

/**
 * TASK COMMENTS API (Ticket 1.3 / 1.9 / 4.2 — Task Discussions)
 *
 * GET  /api/tasks/comments?task_id=X
 *   - Returns all comments for a task (or subtask), oldest first
 *
 * POST /api/tasks/comments
 *   - Creates a new comment on a task (or subtask)
 *   - Body: { task_id, sender_id, sender_name, body, parent_id? }
 *
 * DELETE /api/tasks/comments?id=X&user_id=Y
 *   - Deletes a comment — only the author can delete their own comment
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const task_id = searchParams.get("task_id");

    if (!task_id) {
      return NextResponse.json(
        { success: false, error: "task_id is required" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `SELECT id, task_id, sender_id, sender_name, body, parent_id, is_edited, edited_at, created_at
            FROM v2_task_comments
            WHERE task_id = ?
            ORDER BY created_at ASC`,
      args: [parseInt(task_id)],
    });

    return NextResponse.json({ success: true, comments: result.rows });
  } catch (error) {
    console.error("GET tasks/comments error:", error);
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
      task_id,
      sender_id,
      sender_name,
      body: commentBody,
      parent_id,
    } = body;

    if (!task_id || !sender_id || !commentBody || !commentBody.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "task_id, sender_id, and body are required",
        },
        { status: 400 },
      );
    }

    // Verify the task exists
    if (!(await taskExists(task_id))) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO v2_task_comments (task_id, sender_id, sender_name, body, parent_id)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id, created_at`,
      args: [
        parseInt(task_id),
        sender_id,
        sender_name || "",
        commentBody.trim(),
        parent_id || null,
      ],
    });

    const row = result.rows[0] || {};

    // Notify the task owner / assignee if someone else commented
    try {
      const taskRes = await db.execute({
        sql: "SELECT user_id, assigned_to, title FROM tasks WHERE id = ?",
        args: [parseInt(task_id)],
      });
      const task = taskRes.rows[0];
      const alreadyNotified = new Set();

      const insertNotif = async (recipientId, title, message, type) => {
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, ?, 0, NOW())`,
          args: [recipientId, title, message, type],
        });
      };

      if (task) {
        const recipients = new Set(
          [task.user_id, task.assigned_to].filter((r) => r && r !== sender_id),
        );
        for (const recipientId of recipients) {
          alreadyNotified.add(recipientId);
          await insertNotif(
            recipientId,
            "New Comment",
            `${sender_name || "Someone"} commented on "${task.title}"`,
            "comment",
          );
        }
      }

      // ─── @Mentions — parse and notify mentioned users ───
      const mentionRegex = /@(\w[\w\s.-]*?\w)\b/g;
      let match;
      const mentionedNames = new Set();
      while ((match = mentionRegex.exec(commentBody)) !== null) {
        mentionedNames.add(match[1].trim().toLowerCase());
      }

      if (mentionedNames.size > 0) {
        const namesArray = [...mentionedNames];
        const placeholders = namesArray.map(() => "?").join(",");
        const mentionRes = await db.execute({
          sql: `SELECT cid, name FROM contacts
                WHERE LOWER(TRIM(name)) IN (${placeholders})
                AND deleted = 0`,
          args: namesArray,
        });

        for (const mentioned of mentionRes.rows) {
          if (alreadyNotified.has(mentioned.cid)) continue;
          if (mentioned.cid === sender_id) continue;

          await insertNotif(
            mentioned.cid,
            "Mention in Comment",
            `${sender_name || "Someone"} mentioned you in a comment on "${task?.title || "a task"}"`,
            "mention",
          );
        }
      }
    } catch (_) {
      // Notification failures should never block comment creation
    }

    return NextResponse.json({
      success: true,
      id: Number(row.id),
      created_at: row.created_at,
    });
  } catch (error) {
    console.error("POST tasks/comments error:", error);
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const user_id = searchParams.get("user_id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    const commentRes = await db.execute({
      sql: "SELECT sender_id FROM v2_task_comments WHERE id = ?",
      args: [parseInt(id)],
    });

    if (commentRes.rows.length > 0) {
      const comment = commentRes.rows[0];
      if (user_id && user_id !== comment.sender_id) {
        return NextResponse.json(
          { success: false, error: "Only the author can delete this comment" },
          { status: 403 },
        );
      }
      await db.execute({
        sql: "DELETE FROM v2_task_comments WHERE id = ?",
        args: [parseInt(id)],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE tasks/comments error:", error);
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
    const body = await req.json();
    const { id, user_id, body: newBody } = body;

    if (!id || !user_id || !newBody || !newBody.trim()) {
      return NextResponse.json(
        { success: false, error: "id, user_id, and body are required" },
        { status: 400 },
      );
    }

    const commentRes = await db.execute({
      sql: "SELECT sender_id FROM v2_task_comments WHERE id = ?",
      args: [parseInt(id)],
    });

    if (commentRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Comment not found" },
        { status: 404 },
      );
    }

    if (user_id !== commentRes.rows[0].sender_id) {
      return NextResponse.json(
        { success: false, error: "Only the author can edit this comment" },
        { status: 403 },
      );
    }

    await db.execute({
      sql: "UPDATE v2_task_comments SET body = ?, is_edited = 1, edited_at = NOW() WHERE id = ?",
      args: [newBody.trim(), parseInt(id)],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT tasks/comments error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
