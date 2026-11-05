import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { createHandler } from "@/lib/api/createHandler";
import { logVentureActivity } from "@/services/ventures/activity";
import { deliverVentureMemberInvitation } from "@/services/ventures/memberRoster";
import { listFounders, inviteFounder, canManageFounders, VENTURE_ROLES } from "@/services/ventures/founders";
import { createVentureMemberInvitation } from "@/models/ventureMemberInvitations";
import { getVentureDisplayNameByCode } from "@/models/ventureWorkspace";

/**
 * GET /api/ventures/[id]/founders
 *
 * List all founders for a venture.
 */
export const GET = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    }

    // Phase 5 hardening: founders are only visible to the venture's members
    // and Future Studio staff — never to any authenticated user.
    const { requireVentureScopedAccess } = await import("@/lib/ventureScopedAccess");
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const founders = await listFounders(id);

    return NextResponse.json({ success: true, founders });
  },
);

/**
 * POST /api/ventures/[id]/founders
 *
 * Invite a new founder / co-founder / executive.
 *
 * Two records, one act: the founder ledger keeps WHO was invited (the screen
 * lists it), and the invitation is what actually reaches the person — emailed
 * through the same `/venture-invite/<token>` acceptance path as every other
 * Venture invitation. Accepting it is what creates the membership.
 */
export const POST = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    }

    // Check management permission
    const permission = await canManageFounders(id, session);
    if (!permission.allowed) {
      return NextResponse.json({ success: false, error: "errors.ventureFoundersManageDenied" }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, role, expires_in_hours } = body;

    // Validate required fields
    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
    }
    if (!role || !role.trim()) {
      return NextResponse.json({ success: false, error: "Role is required." }, { status: 400 });
    }
    if (!VENTURE_ROLES.includes(role)) {
      return NextResponse.json({
        success: false,
        error: `Invalid role. Must be one of: ${VENTURE_ROLES.join(", ")}`,
      }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ success: false, error: "Invalid email format." }, { status: 400 });
    }

    try {
      // One expiry for both records, so the founder ledger and the emailed link
      // never disagree about when the invitation dies.
      const expiresInHours = expires_in_hours || 72;

      const result = await inviteFounder({
        ventureId: id,
        invitedByFounderId: permission.founderId,
        email: email.trim(),
        name: name.trim(),
        role,
        expiresInHours,
      });

      // The invitation the person actually receives. Re-inviting the same
      // address reuses the pending row and mints a NEW link, so the earlier
      // one stops working.
      const invitation = await createVentureMemberInvitation({
        ventureId: id,
        email: email.trim(),
        name: name.trim(),
        memberType: "founder",
        role,
        invitedByCid: session.cid || null,
        expiresInHours,
      });

      let ventureName = "the Venture";
      try {
        const nameResult = await getVentureDisplayNameByCode(id);
        ventureName = nameResult.rows?.[0]?.venture_name || ventureName;
      } catch (_) {}

      // Email + delivery recorded; never blocks the answer on the mailer.
      const { emailSent, emailError } = await deliverVentureMemberInvitation({
        invitation,
        ventureName,
        memberType: "founder",
        inviterName: session.name || null,
      });

      // Log activity
      await logVentureActivity({
        venture_id: id,
        action: "FOUNDER_INVITED",
        actor_cid: session.cid || "system",
        actor_name: session.name || "System",
        details: {
          invited_email: email.trim(),
          invited_name: name.trim(),
          role,
          is_resend: result.isResend,
          email_sent: emailSent,
        },
      });

      return NextResponse.json({
        success: true,
        founder_id: result.id,
        // The invitation exists either way; the screen must be able to tell
        // "invited" from "saved, but the email did not go out".
        email_sent: emailSent,
        ...(emailError ? { email_error: emailError } : {}),
        invitation: {
          expires_at: invitation.expires_at,
          is_resend: result.isResend,
        },
      });
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
  },
);
