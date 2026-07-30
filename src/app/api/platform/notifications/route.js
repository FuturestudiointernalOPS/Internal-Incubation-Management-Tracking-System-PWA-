import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * PLATFORM NOTIFICATIONS API
 *
 * GET  /api/platform/notifications           — List user's unread notifications
 * GET  /api/platform/notifications?all=true   — List all notifications for user
 * POST /api/platform/notifications            — Mark notification(s) as read
 *   { id: number } or { mark_all: true }
 */
export async function GET(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    const sql = all
      ? "SELECT * FROM platform_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
      : "SELECT * FROM platform_notifications WHERE user_id = ? AND read = false ORDER BY created_at DESC LIMIT 20";

    const result = await db.execute({ sql, args: [session.cid] });
    return NextResponse.json({ success: true, notifications: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const body = await req.json();

    if (body.mark_all) {
      await db.execute({
        sql: "UPDATE platform_notifications SET read = true WHERE user_id = ? AND read = false",
        args: [session.cid],
      });
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      await db.execute({
        sql: "UPDATE platform_notifications SET read = true WHERE id = ? AND user_id = ?",
        args: [parseInt(body.id), session.cid],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "id or mark_all required" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
