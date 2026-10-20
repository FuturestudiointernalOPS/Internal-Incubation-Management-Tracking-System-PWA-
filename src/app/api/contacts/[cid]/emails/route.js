import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { isMemberSurfaceRole } from "@/lib/identity";
import {
  getEmailLogForContact,
} from "@/models/contacts/registry";

/**
 * GET /api/contacts/[cid]/emails
 *
 * The person's email history from the SHARED delivery log — the same log the
 * run overview reads. Standalone sends (invitations, password setup, approvals,
 * credentials, campaigns) and workflow emails all appear here with their real
 * status and the reason for a failure, so "sent" can be verified per person.
 */
export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const session = await getSession();
    const { cid } = await params;

    // A PERSONAL identity (member, or a legacy participant/founder value) sees
    // only their own history — same rule as the contact timeline.
    if (isMemberSurfaceRole(session?.role) && session.cid !== cid) {
      return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const result = await getEmailLogForContact(cid, limit);
    return NextResponse.json({ success: true, emails: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
