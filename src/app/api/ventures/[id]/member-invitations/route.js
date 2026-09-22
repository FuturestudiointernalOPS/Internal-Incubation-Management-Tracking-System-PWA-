import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  listVentureMemberInvitations,
  revokeVentureMemberInvitation,
} from "@/models/ventureMemberInvitations";
import {
  resolveVentureCode,
  checkVentureMemberViewAccess,
  checkVentureMemberMutateAccess,
} from "@/models/ventureMemberAccess";

/**
 * GET    /api/ventures/[id]/member-invitations — pending invitations
 * DELETE /api/ventures/[id]/member-invitations?id=N — withdraw one
 *
 * Only pending invitations are listed; an accepted or revoked one is history and
 * belongs to the membership record, not here.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const session = await getSession();
    const userCid = session?.cid || "";
    const userRole = session?.role || "";

    const code = await resolveVentureCode(db, id);
    if (!(await checkVentureMemberViewAccess(db, code, userRole, userCid))) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    const invitations = await listVentureMemberInvitations(code);
    return NextResponse.json({ success: true, invitations });
  } catch (error) {
    console.error("GET /api/ventures/[id]/member-invitations error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const invitationId = Number(new URL(req.url).searchParams.get("id"));
    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: "An invitation id is required." },
        { status: 400 },
      );
    }

    const session = await getSession();
    const userCid = session?.cid || "";
    const userRole = session?.role || "";

    const code = await resolveVentureCode(db, id);
    if (!(await checkVentureMemberMutateAccess(db, code, userRole, userCid))) {
      return NextResponse.json(
        { success: false, error: "Only founders can manage venture members." },
        { status: 403 },
      );
    }

    const result = await revokeVentureMemberInvitation({ id: invitationId, ventureId: code });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: "This invitation is no longer pending." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/ventures/[id]/member-invitations error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
