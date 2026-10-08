import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { resolveAppUrl } from "@/lib/appUrl";
import { beginConnect, isGoogleCalendarConfigured } from "@/services/integrations/googleCalendar";

/**
 * GET /api/integrations/google-calendar/connect — starts the OAuth2 flow.
 *
 * Sets a short-lived httpOnly cookie holding a random `state` and redirects to
 * Google's consent screen; the callback refuses any answer whose state does not
 * match the cookie (CSRF / login-fixation protection).
 */

const STATE_COOKIE = "gcal_oauth_state";

export async function GET() {
  const authError = await requireAuth(["super_admin"]);
  if (authError) return authError;

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(`${resolveAppUrl()}/admin?gcal=notConfigured`);
  }

  const { state, url } = beginConnect();
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax", // must survive the top-level redirect back from Google
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/google-calendar",
    maxAge: 600,
  });
  return response;
}
