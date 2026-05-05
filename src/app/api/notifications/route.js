import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

/**
 * NOTIFICATIONS API — SIGNAL AGGREGATION
 * Fetches real-time alerts for the Super Admin (Approvals, Alerts, etc.)
 */

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get('recipient_id') || 'sa';

    // Fetch unread notifications for the admin
    const result = await db.execute({
      sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? AND is_read = FALSE ORDER BY created_at DESC",
      args: [recipientId]
    });

    return NextResponse.json({ success: true, notifications: result.rows });
  } catch (error) {
    console.error("GET Notifications Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const { id, action } = await req.json();

    if (action === 'read') {
      await db.execute({
        sql: "UPDATE v2_notifications SET is_read = TRUE WHERE id = ?",
        args: [id]
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
