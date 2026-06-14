import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password/:cid
 *
 * Generates a password reset token and sends a reset email.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const cid = params.cid;

    const contactRes = await db.execute({
      sql: "SELECT cid, name, email FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (contactRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const contact = contactRes.rows[0];
    const token = uuidv4();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/activate?token=${token}&mode=reset`;

    await db.execute({
      sql: "INSERT INTO password_setup_tokens (token, user_cid, token_type, expires_at) VALUES (?, ?, 'password_reset', NOW() + INTERVAL '48 hours')",
      args: [token, cid],
    });

    sendPasswordResetEmail({ to: contact.email, name: contact.name, resetUrl }).catch((e) =>
      console.error("Password reset email failed:", e),
    );

    return NextResponse.json({ success: true, message: "Password reset email sent" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
