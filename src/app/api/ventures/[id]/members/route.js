import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { createVentureMemberInvitation } from "@/models/ventureMemberInvitations";
import {
  getVentureByCode,
  listVentureMembersWithContacts,
  findVentureMemberByEmail,
  getVentureDisplayNameByCode,
  getVentureMemberById,
  getVentureMemberContactId,
  archiveVentureMember,
  updateVentureMemberFields,
} from "@/models/ventureWorkspace";
import {
  resolveVentureCode,
  getVentureFounderCount,
  checkVentureMemberViewAccess as checkAccess,
  checkVentureMemberMutateAccess as checkMutateAccess,
} from "@/models/ventureMemberAccess";
import {
  deliverVentureMemberInvitation,
  afterVentureMemberRemoved,
  afterVentureMemberUpdated,
} from "@/services/ventures/memberRoster";


export async function GET(req, { params }) {
  try {
    await initDb();
    // Phase I6A: venture access is decided per-venture below — checkAccess
    // (active venture_members row OR venture_staff_assignments) for every
    // non-global session, archived-state gate after. The role pre-filter
    // blocked baseline Members who hold exactly that membership.
    const authError = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const session = await getSession();
    const userCid = session?.cid || "";
    const userRole = session?.role || "";

    const hasAccess = await checkAccess(db, id, userRole, userCid);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    // Archived Ventures: privileged staff may read the roster (historical);
    // non-privileged members lose active access (Phase 3).
    try {
      const { requireOperationalVentureAccess, roleIsPrivileged } = await import("@/lib/ventureAuth");
      if (!roleIsPrivileged(userRole)) {
        const gate = await requireOperationalVentureAccess({ ventureId: id, session: { role: userRole }, mutate: false });
        if (!gate.ok && gate.code === "archived") {
          return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 403 });
        }
      }
    } catch (_) {}

    await getVentureByCode(id);
    const code = await resolveVentureCode(db, id);

    const result = await listVentureMembersWithContacts(code);

    return NextResponse.json({ success: true, members: result.rows });
  } catch (error) {
    console.error("GET /api/ventures/[id]/members error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    // Phase I6A: roster mutation is decided per-venture below — checkAccess,
    // then checkMutateAccess (founder row OR founders:manage capability) for
    // every non-global session. The role pre-filter blocked baseline Members
    // who hold a legitimate founder/team relationship.
    const authError = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();
    const { email, name, member_type } = body;

    const session = await getSession();
    const userCid = session?.cid || "";
    const userRole = session?.role || "";

    const hasAccess = await checkAccess(db, id, userRole, userCid);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const canMutate = await checkMutateAccess(db, id, userRole, userCid);
    if (!canMutate) {
      return NextResponse.json(
        { success: false, error: "Only founders can manage venture members." },
        { status: 403 },
      );
    }

    // Archived Ventures are immutable (Phase 3) — no member mutations.
    try {
      const { requireOperationalVentureAccess } = await import("@/lib/ventureAuth");
      const gate = await requireOperationalVentureAccess({ ventureId: id, session: { role: userRole }, mutate: true });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 409 });
      }
    } catch (_) {}

    const emailNorm = typeof email === "string" ? email.trim() : "";
    if (!emailNorm || !emailNorm.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 },
      );
    }
    const memberType = member_type || "team_member";
    if (!["founder", "team_member"].includes(memberType)) {
      return NextResponse.json(
        { success: false, error: "member_type must be 'founder' or 'team_member'" },
        { status: 400 },
      );
    }

    const code = await resolveVentureCode(db, id);

    // Someone already on the roster does not need an invitation.
    const alreadyMember = await findVentureMemberByEmail(code, emailNorm);
    if (alreadyMember.rows?.length) {
      return NextResponse.json(
        { success: false, error: "This person is already a member of this Venture." },
        { status: 409 },
      );
    }

    // Invite ≠ member: the add creates a PENDING invitation and emails a link.
    // The person joins (and gains access) only once they accept it.
    const invitation = await createVentureMemberInvitation({
      ventureId: code,
      email: emailNorm,
      name: typeof name === "string" ? name.trim() : null,
      memberType,
      invitedByCid: userCid || null,
    });

    // The Venture's display name is needed by both the in-app notification and
    // the email below — ask for it once.
    let ventureName = "the Venture";
    try {
      const ventureResult = await getVentureDisplayNameByCode(code);
      ventureName = ventureResult.rows?.[0]?.venture_name || ventureName;
    } catch (_) {}

    // In-app notice (account holders, first send), email, delivery recorded:
    // services/ventures/memberRoster.
    const { emailSent, emailError } = await deliverVentureMemberInvitation({
      invitation, ventureName, memberType, inviterName: session?.name || null,
    });

    return NextResponse.json({
      success: true,
      // The invitation was created either way; `email_sent` lets the screen tell
      // the founder apart "invited" from "saved, but the email did not go out".
      email_sent: emailSent,
      ...(emailError ? { email_error: emailError } : {}),
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expires_at: invitation.expires_at,
        resent: invitation.resent,
      },
    });
  } catch (error) {
    console.error("POST /api/ventures/[id]/members error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    // Phase I6A: same per-venture decision as POST — checkAccess +
    // checkMutateAccess gate every session; authentication only here.
    const authError = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();
    const { member_id, role, permissions, action } = body;

    const session = await getSession();
    const userCid = session?.cid || "";
    const userRole = session?.role || "";

    const hasAccess = await checkAccess(db, id, userRole, userCid);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const canMutate = await checkMutateAccess(db, id, userRole, userCid);
    if (!canMutate) {
      return NextResponse.json(
        { success: false, error: "Only founders can manage venture members." },
        { status: 403 },
      );
    }

    // Archived Ventures are immutable (Phase 3) — no member mutations.
    try {
      const { requireOperationalVentureAccess } = await import("@/lib/ventureAuth");
      const gate = await requireOperationalVentureAccess({ ventureId: id, session: { role: userRole }, mutate: true });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 409 });
      }
    } catch (_) {}

    if (!member_id) {
      return NextResponse.json({ success: false, error: "member_id is required" }, { status: 400 });
    }

    if (action === "remove") {
      const memberResult = await getVentureMemberById(member_id, id);

      if (!memberResult.rows?.[0]) {
        return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
      }

      if (memberResult.rows[0].member_type === "founder") {
        const founderCount = await getVentureFounderCount(db, id);
        if (founderCount <= 1) {
          return NextResponse.json(
            { success: false, error: "Every venture must have at least one founder. Cannot remove the last founder." },
            { status: 409 },
          );
        }
      }

      await archiveVentureMember(member_id, id);

      // Access dropped now, history row closed, grants reconciled:
      // services/ventures/memberRoster.
      await afterVentureMemberRemoved({ ventureParam: id, member: memberResult.rows[0], actorCid: userCid });
    } else {
      let memberContactId = null;
      try {
        const memberContactResult = await getVentureMemberContactId(member_id, id);
        memberContactId = memberContactResult.rows?.[0]?.contact_id || null;
      } catch (_) {}
      const updates = [];
      const updateArgs = [];
      // Role and permissions are server-controlled fields: downstream access
      // facts read them, so an arbitrary client string must not be written.
      const MEMBER_ROLES = new Set(["member", "founder", "admin", "lead"]);
      if (role !== undefined) {
        const nextRole = String(role).trim().toLowerCase();
        if (!MEMBER_ROLES.has(nextRole)) {
          return NextResponse.json({ success: false, error: "Unknown member role." }, { status: 400 });
        }
        updates.push("role = ?");
        updateArgs.push(nextRole);
      }
      if (permissions !== undefined) {
        if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
          return NextResponse.json({ success: false, error: "permissions must be an object." }, { status: 400 });
        }
        updates.push("permissions = ?");
        updateArgs.push(permissions);
      }
      if (updates.length === 0) {
        return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
      }
      updateArgs.push(member_id, id);
      await updateVentureMemberFields(updates, updateArgs);
      // Access dropped, history row (role change), grants reconciled:
      // services/ventures/memberRoster.
      await afterVentureMemberUpdated({ ventureParam: id, memberContactId, role, actorCid: userCid });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/ventures/[id]/members error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
