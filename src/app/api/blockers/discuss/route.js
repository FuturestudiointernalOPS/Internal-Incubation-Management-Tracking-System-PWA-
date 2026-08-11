import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * BLOCKER DISCUSSIONS API (Ticket 1.9)
 *
 * GET  /api/blockers/discuss?blocker_id=X
 *   - Returns all messages linked to a blocker, oldest first
 *
 * POST /api/blockers/discuss
 *   - Creates a new discussion message on a blocker
 *   - Body: { blocker_id, sender_id, sender_name, body }
 *   - Notifies the blocker creator if someone else comments
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const blocker_id = searchParams.get("blocker_id");

    if (!blocker_id) {
      return NextResponse.json(
        { success: false, error: "blocker_id is required" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `SELECT id, sender_id, body, target_type, target_id, created_at
            FROM v2_messages
            WHERE target_type = 'blocker' AND target_id = ?
            ORDER BY created_at ASC`,
      args: [blocker_id],
    });

    return NextResponse.json({ success: true, messages: result.rows });
  } catch (error) {
    console.error("GET blockers/discuss error:", error);
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
    const { blocker_id, sender_id, sender_name, body: msgBody } = body;

    if (!blocker_id || !sender_id || !msgBody || !msgBody.trim()) {
      return NextResponse.json(
        { success: false, error: "blocker_id, sender_id, and body are required" },
        { status: 400 },
      );
    }

    // Verify the blocker exists
    const blockerCheck = await db.execute({
      sql: "SELECT id, user_id, title, task_id FROM blockers WHERE id = ?",
      args: [parseInt(blocker_id)],
    });
    if (blockerCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Blocker not found" },
        { status: 404 },
      );
    }
    const blocker = blockerCheck.rows[0];

    const result = await db.execute({
      sql: `INSERT INTO v2_messages (sender_id, body, target_type, target_id)
            VALUES (?, ?, 'blocker', ?)
            RETURNING id, created_at`,
      args: [sender_id, msgBody.trim(), blocker_id],
    });

    // Notify the blocker creator (unless they're the one commenting)
    if (blocker.user_id && blocker.user_id !== sender_id) {
      try {
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read)
                VALUES (?, ?, ?, ?, 0)`,
          args: [
            blocker.user_id,
            "New Discussion on Blocker",
            `${sender_name || "Someone"} commented on your blocker: "${blocker.title}"`,
            "blocker_discussion",
          ],
        });
      } catch (_) {}
    }

    // Also notify super admin if they're not the sender
    if (sender_id !== "sa") {
      try {
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read)
                VALUES (?, ?, ?, ?, 0)`,
          args: [
            "sa",
            "New Discussion on Blocker",
            `${sender_name || "Someone"} commented on blocker: "${blocker.title}"`,
            "blocker_discussion",
          ],
        });
      } catch (_) {}
    }

    const row = result.rows[0] || {};
    return NextResponse.json({
      success: true,
      id: Number(row.id),
      created_at: row.created_at,
    });
  } catch (error) {
    console.error("POST blockers/discuss error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
