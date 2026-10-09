import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { roleHomeHref } from "@/models/platform/roles";

export const dynamic = "force-dynamic";

/**
 * /open/venture/[code] — where the "Open in ImpactOS" button of a reminder
 * email leads (see `src/lib/email/senders/reminders.js`).
 *
 * The email cannot know, when it is sent, whether its reader will be signed in
 * when they click, so the decision is taken here, at click time:
 *
 *   - signed in            → the Venture, on the page their role can open;
 *   - signed out           → the login page, which brings them back here once
 *                            they have signed in (and so on to the Venture);
 *   - signed out, ?signup=1 → registration: the address the email was sent to
 *                            had no account.
 *
 * Public in `src/proxy.js` on purpose: without that, a signed-out click would
 * be bounced to the login page before this route could choose registration.
 * It reveals nothing — every destination is gated by its own section.
 */

/** The Venture page each role can actually open. */
function ventureHrefForRole(role, code) {
  const encoded = encodeURIComponent(code);
  switch (String(role || "").toLowerCase()) {
    case "super_admin":
      return `/admin/ventures/projects/${encoded}`;
    case "staff":
      return `/staff/ventures/${encoded}`;
    case "participant":
    case "member":
    case "founder":
    case "applicant":
      return `/participant/ventures/${encoded}`;
    default:
      return roleHomeHref(role) || "/workspaces";
  }
}

export async function GET(req, { params }) {
  const { code } = await params;
  const ventureCode = String(code || "").trim();
  const signup = req.nextUrl.searchParams.get("signup") === "1";

  const session = await getSession().catch(() => null);

  let target;
  if (session && ventureCode) {
    target = ventureHrefForRole(session.role, ventureCode);
  } else if (session) {
    target = roleHomeHref(session.role) || "/workspaces";
  } else if (signup) {
    target = "/register-staff";
  } else {
    // Back through this route after sign-in, so the role decides the page.
    const self = `/open/venture/${encodeURIComponent(ventureCode)}`;
    target = `/login?next=${encodeURIComponent(self)}`;
  }

  return NextResponse.redirect(new URL(target, req.url));
}
