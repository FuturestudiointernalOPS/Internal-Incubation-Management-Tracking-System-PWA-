import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { requireAuth, getSession } from "@/lib/auth";

/**
 * NOTIFICATIONS API — SIGNAL AGGREGATION
 * Fetches real-time alerts for the Super Admin (Approvals, Alerts, etc.)
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { recipient_id, title, message, type } = await req.json();

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Title and message required" },
        { status: 400 },
      );
    }

    const recipientId = recipient_id || session.cid;
    if (
      recipient_id &&
      String(recipient_id) !== String(session.cid) &&
      !["super_admin", "staff", "program_manager"].includes(session.role)
    ) {
      return NextResponse.json(
        { success: false, error: "You cannot create notifications for other users." },
        { status: 403 },
      );
    }

    await db.execute({
      sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, NOW())`,
      args: [recipientId, title, message, type || "general"],
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
    const { searchParams } = new URL(req.url);

    // Try to get notifications — if auth fails, return empty (graceful degradation)
    try {
      const authError = await requireAuth();
      if (authError) {
        return NextResponse.json({ success: true, notifications: [] });
      }
    } catch (_) {
      return NextResponse.json({ success: true, notifications: [] });
    }

    const session = await getSession();
    let recipientId = searchParams.get("recipient_id") || session?.cid || "sa";
    if (
      session &&
      searchParams.get("recipient_id") &&
      String(searchParams.get("recipient_id")) !== String(session.cid) &&
      !["super_admin", "staff", "program_manager"].includes(session.role)
    ) {
      recipientId = session.cid; // force own inbox, no info leak
    }

    let rows = [];
    try {
      const result = await db.execute({
        sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50",
        args: [recipientId],
      });
      rows = result.rows || [];
      rows = rows.filter((r) => r.is_read == 0 || r.is_read == null);
    } catch (_) {
      rows = [];
    }

    return NextResponse.json({
      success: true,
      notifications: rows,
    });
  } catch (error) {
    console.error("GET Notifications Error:", error);
    return NextResponse.json({ success: true, notifications: [] });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { id, action } = await req.json();

    if (action === "read") {
      const nRes = await db.execute({
        sql: "SELECT recipient_id FROM v2_notifications WHERE id = ?",
        args: [parseInt(id)],
      });
      if (!nRes.rows || nRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Notification not found." },
          { status: 404 },
        );
      }
      if (
        String(nRes.rows[0].recipient_id) !== String(session.cid) &&
        !["super_admin", "staff", "program_manager"].includes(session.role)
      ) {
        return NextResponse.json(
          { success: false, error: "You cannot modify this notification." },
          { status: 403 },
        );
      }
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
