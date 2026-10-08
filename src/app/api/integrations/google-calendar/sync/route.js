import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { syncUser, syncUserIfStale } from "@/services/integrations/googleCalendar";

/**
 * POST /api/integrations/google-calendar/sync          — "sync now" button
 * POST /api/integrations/google-calendar/sync?ifStale=1 — dashboard load: only
 *      when the last sync is older than a few minutes.
 */
export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    await initDb();
    const session = await getSession();
    const ifStale = new URL(req.url).searchParams.get("ifStale") === "1";
    const result = ifStale ? await syncUserIfStale(session.cid) : await syncUser(session.cid);
    return NextResponse.json({ success: result.ok, ...result }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("[Google Calendar API] sync:", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}
