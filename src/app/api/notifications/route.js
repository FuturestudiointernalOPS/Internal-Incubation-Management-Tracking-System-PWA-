import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/auth";

/**
 * NOTIFICATIONS API — SIGNAL AGGREGATION
 * Fetches real-time alerts for the Super Admin (Approvals, Alerts, etc.)
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { recipient_id, title, message, type } = await req.json();

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Title and message required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, NOW())`,
      args: [recipient_id || "sa", title, message, type || "general"],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST Notification Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get("recipient_id") || "sa";

    let rows = [];
    try {
      const result = await db.execute({
        sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50",
        args: [recipientId],
      });
      rows = result.rows || [];
      // Filter unread in JS to avoid type mismatch on is_read column
      rows = rows.filter((r) => r.is_read == 0 || r.is_read == null);
    } catch (_) {
      // Table or column may not exist in all environments
      rows = [];
    }

    return NextResponse.json({
      success: true,
      notifications: rows,
    });
  } catch (error) {
    console.error("GET Notifications Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { id, action } = await req.json();

    if (action === "read") {
      await db.execute({
        sql: "UPDATE v2_notifications SET is_read = 1 WHERE id = ?",
        args: [id],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("PATCH Notifications Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
