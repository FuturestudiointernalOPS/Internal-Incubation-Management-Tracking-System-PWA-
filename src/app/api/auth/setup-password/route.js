import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

/**
 * SET PASSWORD VIA SETUP TOKEN
 * POST /api/auth/setup-password
 * Body: { token, password }
 *
 * Flow:
 * 1. Validate token (exists, not used, not expired)
 * 2. Hash the password
 * 3. Update contacts table with new password and status = 'active'
 * 4. Mark token as used
 * 5. Log the event
 */
export async function POST(req) {
  try {
    await initDb();
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 }
      );
    }

    // 1. Validate token
    const tokenResult = await db.execute({
      sql: `SELECT * FROM password_setup_tokens
            WHERE token = ? AND used = false AND expires_at > NOW()`,
      args: [token],
    });

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { error: "This link is invalid or has expired." },
        { status: 410 }
      );
    }

    const setupRecord = tokenResult.rows[0];

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Update user - set password and status to active
    await db.execute({
      sql: "UPDATE contacts SET password = ?, status = 'active' WHERE cid = ?",
      args: [hashedPassword, setupRecord.user_cid],
    });

    // 4. Mark token as used
    await db.execute({
      sql: "UPDATE password_setup_tokens SET used = true WHERE token = ?",
      args: [token],
    });

    // 5. Audit log
    try {
      await db.execute({
        sql: `INSERT INTO audit_log (entity_type, entity_id, user_id, user_name, action, details)
              VALUES ('user', 0, ?, ?, 'password_setup', 'Password set via secure setup link')`,
        args: [setupRecord.user_cid, setupRecord.user_email],
      });
    } catch (e) {
      // Audit logging is non-critical
      console.error("Audit log error (non-critical):", e.message);
    }

    return NextResponse.json({
      success: true,
      message: "Password has been set successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Password setup error:", error);
    return NextResponse.json(
      { error: "Failed to set password." },
      { status: 500 }
    );
  }
}
