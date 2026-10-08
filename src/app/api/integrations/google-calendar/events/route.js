import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { listDashboardItems } from "@/services/integrations/googleCalendar";

/**
 * GET /api/integrations/google-calendar/events — the events the user added in
 * Google to the "Future Studio" calendar, shaped like dashboard calendar items.
 * Personal calendars are never read (see the service), so nothing else can appear.
 */
export async function GET() {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    await initDb();
    const session = await getSession();
    const events = await listDashboardItems(session.cid);
    return NextResponse.json({ success: true, events });
  } catch (error) {
    console.error("[Google Calendar API] events:", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}
