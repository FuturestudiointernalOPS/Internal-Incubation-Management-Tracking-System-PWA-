import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { resolveAppUrl } from "@/lib/appUrl";
import { safeNextPath } from "@/lib/safeNextPath";
import { beginConnect, isGoogleCalendarConfigured } from "@/services/integrations/googleCalendar";

/**
 * GET /api/integrations/google-calendar/connect — starts the OAuth2 flow.
 *
 * Available to every authenticated user (any role). Sets a short-lived httpOnly
 * cookie holding a random `state` and redirects to Google's consent screen; the
 * callback refuses any answer whose state does not match the cookie (CSRF /
 * login-fixation protection). An optional `next` (an internal path) is kept in a
 * second cookie so the callback can return the person to the page they came from.
 */

const STATE_COOKIE = "gcal_oauth_state";
const NEXT_COOKIE = "gcal_oauth_next";

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax", // must survive the top-level redirect back from Google
  secure: process.env.NODE_ENV === "production",
  path: "/api/integrations/google-calendar",
  maxAge: 600,
});

export async function GET(req) {
  const authError = await requireAuth();
  if (authError) return authError;

  const next = safeNextPath(new URL(req.url).searchParams.get("next"));
  const home = next || "/";

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(`${resolveAppUrl()}${home}?gcal=notConfigured`);
  }

  const { state, url } = beginConnect();
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, cookieOptions());
  if (next) response.cookies.set(NEXT_COOKIE, next, cookieOptions());
  return response;
}
