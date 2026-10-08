import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { listNotifications, markNotificationsRead } from "@/services/platform/notifications";

/**
 * PLATFORM NOTIFICATIONS API
 *
 * GET  /api/platform/notifications           — List user's unread notifications
 * GET  /api/platform/notifications?all=true   — List all notifications for user
 * POST /api/platform/notifications            — Mark notification(s) as read
 *   { id: number } or { mark_all: true }
 *
 * Thin controller: gates the session and delegates to
 * `@/services/platform/notifications` (see docs/LAYER_SPLIT.md).
 */
export async function GET(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    const { body } = await listNotifications({ cid: session.cid, all });
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const body = await req.json();
    const { status, body: responseBody } = await markNotificationsRead({ body, cid: session.cid });
    return NextResponse.json(responseBody, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
