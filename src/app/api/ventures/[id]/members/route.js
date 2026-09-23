import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";
import { resolveAppUrl } from "@/lib/appUrl";
import { createVentureMemberInvitation } from "@/models/ventureMemberInvitations";
import {
  resolveVentureCode,
  getVentureFounderCount,
  checkVentureMemberViewAccess as checkAccess,
  checkVentureMemberMutateAccess as checkMutateAccess,
} from "@/models/ventureMemberAccess";

/**
 * Phase 6: reconcile a person's context grants after a membership write.
 * Never throws, never blocks the response.
 */
async function applyContextGrants(cid) {
  if (!cid) return;
  try {
    const { syncContextGrantsForUser } = await import("@/models/authorization/contextGrants");
    await syncContextGrantsForUser(cid);
  } catch (_) {}
}

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
        const gate = await requireOperationalVentureAccess({ ventureId: id, db, session: { role: userRole }, mutate: false });
        if (!gate.ok && gate.code === "archived") {
          return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 403 });
        }
      }
    } catch (_) {}

    await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
    const code = await resolveVentureCode(db, id);

    const result = await db.execute({
      sql: `
        SELECT vm.*, c.name as contact_name, c.email as contact_email
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.removed_at IS NULL
        ORDER BY vm.member_type, vm.joined_at DESC
      `,
      args: [code],
    });

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
      const gate = await requireOperationalVentureAccess({ ventureId: id, db, session: { role: userRole }, mutate: true });
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
    const alreadyMember = await db.execute({
      sql: `SELECT 1 FROM venture_members vm
            JOIN contacts c ON c.cid = COALESCE(vm.contact_id, vm.user_cid)
            WHERE vm.venture_id = ? AND vm.removed_at IS NULL AND LOWER(c.email) = LOWER(?)
            LIMIT 1`,
      args: [code, emailNorm],
    });
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

    // Never block the answer on the mailer: a failed send is logged and the
    // invitation stays pending, so the founder can send it again.
    try {
      const ventureResult = await db.execute({
        sql: "SELECT COALESCE(NULLIF(name, ''), company_name) AS venture_name FROM ventures WHERE venture_id = ? LIMIT 1",
        args: [code],
      });
      const ventureName = ventureResult.rows?.[0]?.venture_name || "the Venture";
      const link = `${resolveAppUrl()}/venture-invite/${invitation.token}`;
      const seat = memberType === "founder" ? "a founder" : "a team member";
      await sendEmail({
        to: invitation.email,
        subject: `You are invited to join ${ventureName} on Impact OS`,
        body:
          `Hello,\n\n` +
          `${session?.name || "A founder of the Venture"} invited you to join ${ventureName} as ${seat}.\n\n` +
          `Open this link to accept the invitation:\n${link}\n\n` +
          `The link expires on ${new Date(invitation.expires_at).toLocaleDateString()}.\n\n` +
          `— Future Studio`,
      });
    } catch (error) {
      console.error("Venture member invitation email failed:", error.message);
    }

    return NextResponse.json({
      success: true,
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
      const gate = await requireOperationalVentureAccess({ ventureId: id, db, session: { role: userRole }, mutate: true });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 409 });
      }
    } catch (_) {}

    if (!member_id) {
      return NextResponse.json({ success: false, error: "member_id is required" }, { status: 400 });
    }

    if (action === "remove") {
      const memberResult = await db.execute({
        sql: "SELECT member_type, contact_id, role FROM venture_members WHERE id = ? AND venture_id = ?",
        args: [member_id, id],
      });

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

      await db.execute({
        sql: "UPDATE venture_members SET removed_at = NOW() WHERE id = ? AND venture_id = ?",
        args: [member_id, id],
      });

      // Close the append-only membership history row (account/contact intact).
      try {
        const { syncVentureRoleHistory } = await import("@/lib/contactIdentity");
        const removedRole = memberResult.rows[0].member_type === "founder" ? "founder" : memberResult.rows[0].role || "member";
        if (memberResult.rows[0].contact_id) {
          await syncVentureRoleHistory({
            contactCid: memberResult.rows[0].contact_id,
            ventureId: id,
            role: removedRole,
            active: false,
            actorCid: userCid || null,
            notes: "member removed — account and CRM contact remain intact",
          });
        }
      } catch (_) {}

      // Phase 6: reconcile grants — if this was the last founder relationship,
      // the capability we applied is withdrawn (manual grants are untouched).
      await applyContextGrants(memberResult.rows[0].contact_id);
    } else {
      let memberContactId = null;
      try {
        const memberContactResult = await db.execute({
          sql: "SELECT contact_id FROM venture_members WHERE id = ? AND venture_id = ?",
          args: [member_id, id],
        });
        memberContactId = memberContactResult.rows?.[0]?.contact_id || null;
      } catch (_) {}
      const updates = [];
      const updateArgs = [];
      if (role !== undefined) { updates.push("role = ?"); updateArgs.push(role); }
      if (permissions !== undefined) { updates.push("permissions = ?"); updateArgs.push(permissions); }
      if (updates.length === 0) {
        return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
      }
      updateArgs.push(member_id, id);
      await db.execute({
        sql: `UPDATE venture_members SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
        args: updateArgs,
      });
      try {
        const { syncVentureRoleHistory } = await import("@/lib/contactIdentity");
        if (memberContactId && role !== undefined) {
          await syncVentureRoleHistory({
            contactCid: memberContactId,
            ventureId: id,
            role: role || "member",
            active: true,
            actorCid: userCid || null,
            notes: "member role updated",
          });
        }
      } catch (_) {}

      // Phase 6: a role change can turn a member into a founder (or back) —
      // reconcile the applied grants for the affected person.
      await applyContextGrants(memberContactId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/ventures/[id]/members error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
