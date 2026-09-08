import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { createHandler } from "@/lib/api/createHandler";
import {
  listFounders,
  getFounderById,
  inviteFounder,
  updateFounderRole,
  removeFounder,
  canManageFounders,
  logVentureActivity,
  createVentureNotification,
  VENTURE_ROLES,
} from "@/lib/ventures";

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
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    // Phase 5 hardening: founders are only visible to the venture's members
    // and Future Studio staff — never to any authenticated user.
    const { requireVentureAccess } = await import("@/lib/ventureAuth");
    const access = await requireVentureAccess(id, db);
    if (!access.session) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    const founders = await listFounders(id);

    return NextResponse.json({ success: true, founders });
  },
);

/**
 * POST /api/ventures/[id]/founders
 *
 * Invite a new founder / co-founder / executive.
 */
export const POST = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    // Check management permission
    const permission = await canManageFounders(id, session);
    if (!permission.allowed) {
      return NextResponse.json({ success: false, error: "Unauthorized to manage founders." }, { status: 403 });
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
      const result = await inviteFounder({
        ventureId: id,
        invitedByFounderId: permission.founderId,
        email: email.trim(),
        name: name.trim(),
        role,
        expiresInHours: expires_in_hours || 72,
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
        },
      });

      return NextResponse.json({
        success: true,
        founder_id: result.id,
        invitation: {
          token: result.token,
          expires_at: result.expires_at,
          is_resend: result.isResend,
        },
      });
    } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
  },
);
