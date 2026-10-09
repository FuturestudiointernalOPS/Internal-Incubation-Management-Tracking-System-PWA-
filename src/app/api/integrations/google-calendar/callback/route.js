import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { resolveAppUrl } from "@/lib/appUrl";
import { safeNextPath } from "@/lib/safeNextPath";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { completeConnect, stateMatches } from "@/services/integrations/googleCalendar";

/**
 * GET /api/integrations/google-calendar/callback?code=…&state=… — Google's redirect.
 *
 * Available to every authenticated user. Verifies the state cookie, exchanges the
 * code (server-to-server, the client secret never reaches the browser), stores
 * the tokens encrypted, creates the "Future Studio" calendar and runs the first
 * sync. Always ends with a redirect back to where the person started (their own
 * section), carrying `?gcal=<outcome>` for the UI to announce.
 */

const STATE_COOKIE = "gcal_oauth_state";
const NEXT_COOKIE = "gcal_oauth_next";

function back(req, outcome) {
  const next = safeNextPath(req.cookies.get(NEXT_COOKIE)?.value) || "/";
  const response = NextResponse.redirect(`${resolveAppUrl()}${next}?gcal=${outcome}`);
  const clear = { path: "/api/integrations/google-calendar", maxAge: 0 };
  response.cookies.set(STATE_COOKIE, "", clear);
  response.cookies.set(NEXT_COOKIE, "", clear);
  return response;
}

export async function GET(req) {
  const authError = await requireAuth();
  if (authError) return NextResponse.redirect(`${resolveAppUrl()}/login`);

  const { searchParams } = new URL(req.url);
  if (searchParams.get("error")) return back(req, "denied"); // user pressed "Cancel" at Google

  const expected = req.cookies.get(STATE_COOKIE)?.value;
  if (!stateMatches(expected, searchParams.get("state"))) return back(req, "invalidState");

  const code = searchParams.get("code");
  if (!code) return back(req, "failed");

  try {
    await initDb();
    const session = await getSession();
    const result = await completeConnect({ userId: session.cid, code });
    if (!result.ok) return back(req, result.error);
    return back(req, result.sync?.ok === false ? "connectedSyncPending" : "connected");
  } catch (error) {
    console.error("[Google Calendar API] callback:", error.message);
    return back(req, "failed");
  }
}
