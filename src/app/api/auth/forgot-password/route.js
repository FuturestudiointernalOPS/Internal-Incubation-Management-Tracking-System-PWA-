import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { sendEmail } from "@/lib/mailer";

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
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find user (don't reveal if they exist)
    const userResult = await db.execute({
      sql: "SELECT cid, name, email FROM contacts WHERE email = ? AND deleted = 0 AND status = 'active' LIMIT 1",
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
        sql: "UPDATE password_setup_tokens SET used = true WHERE user_cid = ? AND used = false",
        args: [user.cid],
      });

      // Create new token
      await db.execute({
        sql: `INSERT INTO password_setup_tokens (user_cid, user_email, token, expires_at, used)
              VALUES (?, ?, ?, ?, false)`,
        args: [
          user.cid,
          user.email,
          token,
          expiresAt.toISOString().replace("T", " ").replace("Z", ""),
        ],
      });

      // Send email
      const protocol = req.headers.get("x-forwarded-proto") || "https";
      const host = req.headers.get("host") || "impactos.futurestudio.com";
      const baseUrl = `${protocol}://${host}`;
      const resetUrl = `${baseUrl}/setup-password/${token}`;

      const emailBody = `
        <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto;">
          <div style="text-align: center; padding: 32px 0;">
            <img src="${baseUrl}/brand/logo_full.png" alt="Future Studio" style="height: 48px;" />
          </div>

          <h1 style="font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.02em; margin-bottom: 8px;">
            Password Reset Request
          </h1>

          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Hello <strong>${user.name}</strong>,
          </p>

          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to set a new password:
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}"
               style="display: inline-block; background: #f97316; color: #000; font-weight: 800;
                      font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;
                      padding: 16px 40px; border-radius: 12px; text-decoration: none;">
              Reset Password
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
            This link will expire in <strong>1 hour</strong> and can only be used once.
            If you did not request this, please ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0;" />

          <p style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">
            Future Studio · ImpactOS
          </p>
        </div>
      `;

      await sendEmail({
        to: user.email,
        subject: "Reset Your Password — Future Studio",
        body: emailBody,
        isHtml: true,
        fromName: "Future Studio Security",
      });
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
