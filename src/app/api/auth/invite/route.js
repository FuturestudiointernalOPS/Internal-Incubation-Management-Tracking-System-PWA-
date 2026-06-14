import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/invite
 *
 * Generates an invite token and sends an activation email.
 * Called automatically when a Super Admin approves a staff member
 * or when a participant registers.
 *
 * Body: { cid, email, name, role, invitedBy?, groupId?, tokenType }
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;

    const { cid, email, name, role, invitedBy, groupId, tokenType = "staff_invite" } = await req.json();

    if (!cid || !email || !name) {
      return NextResponse.json({ success: false, error: "cid, email, and name are required" }, { status: 400 });
    }

    const token = uuidv4();

    await db.execute({
      sql: `INSERT INTO password_setup_tokens (token, user_cid, token_type, invited_by, role, group_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW() + INTERVAL '48 hours')`,
      args: [token, cid, tokenType, invitedBy || null, role || null, groupId || null],
    });

    await db.execute({
      sql: "UPDATE contacts SET invited_at = NOW() WHERE cid = ?",
      args: [cid],
    });

    // Send email (non-blocking — fire and forget)
    sendInviteEmail({ to: email, name, role, token }).catch((e) =>
      console.error("Invite email failed:", e),
    );

    return NextResponse.json({ success: true, message: "Invite sent", token });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
