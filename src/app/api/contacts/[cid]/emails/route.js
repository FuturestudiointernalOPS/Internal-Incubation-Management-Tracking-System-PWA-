import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { getEmailLogForContact } from "@/models/contacts";

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

    // A participant/founder sees only their own history — same rule as the
    // contact timeline.
    if ((session.role === "participant" || session.role === "founder") && session.cid !== cid) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    const result = await getEmailLogForContact(cid, limit);
    return NextResponse.json({ success: true, emails: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
