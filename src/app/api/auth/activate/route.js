import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/activate?token=XXX
 *
 * Validates an activation token and returns user info for the activation page.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required" }, { status: 400 });
    }

    const tokenRes = await db.execute({
      sql: `SELECT pt.*, c.name, c.email, c.role
            FROM password_setup_tokens pt
            JOIN contacts c ON pt.user_cid = c.cid
            WHERE pt.token = ? AND pt.used_at IS NULL AND pt.expires_at > NOW()`,
      args: [token],
    });

    if (tokenRes.rows.length === 0) {
      // Check if token exists but expired
      const expiredRes = await db.execute({
        sql: "SELECT expires_at FROM password_setup_tokens WHERE token = ?",
        args: [token],
      });

      if (expiredRes.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: "This link has expired. Contact your administrator.", expired: true },
          { status: 400 },
        );
      }

      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 400 });
    }

    const record = tokenRes.rows[0];

    return NextResponse.json({
      success: true,
      name: record.name,
      email: record.email,
      role: record.role || record.token_type?.replace("_invite", "").replace("_", " "),
      cid: record.user_cid,
      tokenType: record.token_type,
    });
  } catch (error) {
    console.error("Activate GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/auth/activate
 *
 * Sets the user's password and activates their account.
 * Body: { token, password }
 */
export async function POST(req) {
  try {
    await initDb();
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ success: false, error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Validate token
    const tokenRes = await db.execute({
      sql: `SELECT pt.*, c.email, c.name, c.role
            FROM password_setup_tokens pt
            JOIN contacts c ON pt.user_cid = c.cid
            WHERE pt.token = ? AND pt.used_at IS NULL AND pt.expires_at > NOW()`,
      args: [token],
    });

    if (tokenRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token. Contact your administrator." },
        { status: 400 },
      );
    }

    const record = tokenRes.rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update contact: set password, mark as active and verified
    await db.execute({
      sql: "UPDATE contacts SET password = ?, status = 'active', email_verified = true, activated_at = NOW() WHERE cid = ?",
      args: [hashedPassword, record.user_cid],
    });

    // Mark token as used
    await db.execute({
      sql: "UPDATE password_setup_tokens SET used_at = NOW() WHERE token = ?",
      args: [token],
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ to: record.email, name: record.name, role: record.role }).catch((e) =>
      console.error("Welcome email failed:", e),
    );

    return NextResponse.json({ success: true, message: "Account activated. You can now log in." });
  } catch (error) {
    console.error("Activate POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
