import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { resolveAppUrl } from "@/lib/appUrl";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { completeConnect, stateMatches } from "@/services/integrations/googleCalendar";

/**
 * GET /api/integrations/google-calendar/callback?code=…&state=… — Google's redirect.
 *
 * Verifies the state cookie, exchanges the code (server-to-server, the client
 * secret never reaches the browser), stores the tokens encrypted, creates the
 * "Future Studio" calendar and runs the first sync. Always ends with a redirect
 * back to the dashboard carrying `?gcal=<outcome>` for the UI to announce.
 */

const STATE_COOKIE = "gcal_oauth_state";

function back(outcome) {
  const response = NextResponse.redirect(`${resolveAppUrl()}/admin?gcal=${outcome}`);
  response.cookies.set(STATE_COOKIE, "", { path: "/api/integrations/google-calendar", maxAge: 0 });
  return response;
}

export async function GET(req) {
  const authError = await requireAuth(["super_admin"]);
  if (authError) return NextResponse.redirect(`${resolveAppUrl()}/login`);

  const { searchParams } = new URL(req.url);
  if (searchParams.get("error")) return back("denied"); // user pressed "Cancel" at Google

  const expected = req.cookies.get(STATE_COOKIE)?.value;
  if (!stateMatches(expected, searchParams.get("state"))) return back("invalidState");

  const code = searchParams.get("code");
  if (!code) return back("failed");

  try {
    await initDb();
    const session = await getSession();
    const result = await completeConnect({ userId: session.cid, code });
    if (!result.ok) return back(result.error);
    return back(result.sync?.ok === false ? "connectedSyncPending" : "connected");
  } catch (error) {
    console.error("[Google Calendar API] callback:", error.message);
    return back("failed");
  }
}
