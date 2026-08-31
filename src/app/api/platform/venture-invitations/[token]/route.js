/**
 * GET /api/platform/venture-invitations/[token]
 *
 * Public token validation for Venture Run invitations. Resolves the invite,
 * marks it opened, and returns the run URL the invitee should complete.
 */

import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import {
  getVentureInvitationByToken,
  markVentureInvitationStatus,
  ventureRunUrl,
} from "@/lib/ventureInvitations";

export async function GET(req, { params }) {
  await initDb();
  try {
    const { token } = await params;
    const { invitation, error } = await getVentureInvitationByToken(token);
    if (error === "invalid" || !invitation) {
      return NextResponse.json({ success: false, error: "Invalid invitation link" }, { status: 404 });
    }
    if (error === "expired") {
      return NextResponse.json({ success: false, error: "This invitation link has expired" }, { status: 410 });
    }

    if (invitation.status === "sent") {
      markVentureInvitationStatus(invitation.id, "opened").catch(() => {});
    }

    const run = (
      await db.execute({ sql: "SELECT id, name, public_slug FROM platform_form_runs WHERE id = ?", args: [invitation.run_id] })
    ).rows[0];
    if (!run || !run.public_slug) {
      return NextResponse.json({ success: false, error: "Venture Run not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      email: invitation.email,
      source_type: invitation.source_type,
      status: invitation.status,
      run: { run_id: run.id, name: run.name, slug: run.public_slug, url: ventureRunUrl(run) },
    });
  } catch (e) {
    console.error("Venture invitation resolve error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
