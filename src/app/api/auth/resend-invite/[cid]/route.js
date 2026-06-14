import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/resend-invite/:cid
 *
 * Invalidates old invite tokens for a user and sends a fresh one.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const cid = params.cid;

    const contactRes = await db.execute({
      sql: "SELECT cid, name, email, role FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (contactRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const contact = contactRes.rows[0];

    // Mark old tokens as expired
    await db.execute({
      sql: "UPDATE password_setup_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE user_cid = ? AND used_at IS NULL",
      args: [cid],
    });

    // Generate new token
    const token = uuidv4();
    await db.execute({
      sql: "INSERT INTO password_setup_tokens (token, user_cid, token_type, role, expires_at) VALUES (?, ?, 'staff_invite', ?, NOW() + INTERVAL '48 hours')",
      args: [token, cid, contact.role],
    });

    sendInviteEmail({ to: contact.email, name: contact.name, role: contact.role, token }).catch((e) =>
      console.error("Resend invite email failed:", e),
    );

    return NextResponse.json({ success: true, message: "Invite resent" });
  } catch (error) {
    console.error("Resend invite error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
