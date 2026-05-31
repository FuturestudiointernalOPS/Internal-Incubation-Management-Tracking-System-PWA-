import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * VALIDATE PASSWORD SETUP TOKEN
 * GET /api/auth/setup-password/validate?token=xxx
 *
 * Returns: { valid: true/false, user: { name, email } } or error
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `SELECT pst.*, c.name as user_name
            FROM password_setup_tokens pst
            LEFT JOIN contacts c ON pst.user_cid = c.cid
            WHERE pst.token = ? AND pst.used = false AND pst.expires_at > NOW()`,
      args: [token],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({
        valid: false,
        error: "This link is invalid or has expired. Please contact your administrator.",
      });
    }

    const record = result.rows[0];
    return NextResponse.json({
      valid: true,
      user: {
        name: record.user_name || "User",
        email: record.user_email,
        cid: record.user_cid,
      },
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate token" },
      { status: 500 }
    );
  }
}
