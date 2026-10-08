import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { disconnect, getStatus } from "@/services/integrations/googleCalendar";

/**
 * Google Calendar integration — the caller's own connection.
 *
 * GET    /api/integrations/google-calendar  → { configured, connected, email, lastSyncedAt, … }
 * DELETE /api/integrations/google-calendar  → revoke the grant, erase stored tokens
 *
 * Available to every authenticated user. Thin controller: the session gate, then
 * `@/services/integrations/googleCalendar`. Tokens never leave the server; the
 * status only says whether one exists.
 */

export async function GET() {
  try {
    const authError = await requireAuth();
    if (authError) return authError;
    await initDb();
    const session = await getSession();
    const status = await getStatus(session.cid);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error("[Google Calendar API] status:", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const authError = await requireAuth();
    if (authError) return authError;
    await initDb();
    const session = await getSession();
    await disconnect(session.cid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Google Calendar API] disconnect:", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}
