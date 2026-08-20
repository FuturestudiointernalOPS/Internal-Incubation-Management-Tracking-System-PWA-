import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { sendPasswordResetEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * FORGOT PASSWORD
 * POST /api/auth/forgot-password
 *
 * Body: { email }
 *
 * Flow:
 * 1. Find user by email
 * 2. Generate reset token (1h expiry)
 * 3. Send email with reset link
 * 4. Always return success (don't reveal if email exists)
 */
export async function POST(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Rate limit: prevents reset-email bombing (5 per IP / 3 per email per 15 min)
    const ipLimited = enforceRateLimit(req, `forgot:ip:${getClientIp(req)}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (ipLimited) return ipLimited;
    const emailLimited = enforceRateLimit(req, `forgot:email:${cleanEmail}`, {
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (emailLimited) return emailLimited;

    // Find user (don't reveal if they exist)
    const userResult = await db.execute({
      sql: "SELECT cid, name, email FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL AND status = 'active' LIMIT 1",
      args: [cleanEmail],
    });

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      // Generate reset token (1 hour expiry)
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      // Invalidate old tokens
      await db.execute({
        sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ? AND used = 0",
        args: [user.cid],
      });

      // Create new token
      const tokenHash = hashToken(token);
      await db.execute({
        sql: `INSERT INTO password_setup_tokens (contact_cid, token, token_hash, expires_at, used)
              VALUES (?, ?, ?, ?, 0)`,
        args: [
          user.cid,
          token,
          tokenHash,
          expiresAt.toISOString().replace("T", " ").replace("Z", ""),
        ],
      });

      // Send email (Gmail primary, Resend fallback via @/lib/email)
      const protocol = req.headers.get("x-forwarded-proto") || "https";
      const host = req.headers.get("host") || "impactos.futurestudio.com";
      const baseUrl = `${protocol}://${host}`;
      const resetUrl = `${baseUrl}/setup-password/${token}`;

      const sendResult = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });

      if (!sendResult?.success) {
        console.error(
          "[forgot-password] Failed to send reset email:",
          sendResult?.provider,
          sendResult?.error || sendResult?.note || "unknown",
        );
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request." },
      { status: 500 }
    );
  }
}
