import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";

/**
 * VALIDATE PASSWORD SETUP TOKEN
 * GET /api/auth/setup-password/validate?token=xxx
 *
 * Returns: { valid: true/false, user: { name, email } } or error
 */
export async function GET(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const result = await db.execute({
      sql: `SELECT pst.*, c.name as user_name, c.email as user_email
            FROM password_setup_tokens pst
            LEFT JOIN contacts c ON pst.contact_cid = c.cid
            WHERE pst.used = 0 AND pst.expires_at > NOW()
              AND (pst.token_hash = ? OR pst.token = ?)`,
      args: [tokenHash, token],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({
        valid: false,
        error: "This link is invalid or has expired. Please contact your administrator.",
      });
    }

    const record = result.rows[0];

    // Lazily backfill the hash for legacy rows stored before hashing was added.
    if (!record.token_hash) {
      await db.execute({
        sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
        args: [tokenHash, record.id],
      }).catch(() => {});
    }
    return NextResponse.json({
      valid: true,
      user: {
        name: record.user_name || "User",
        email: record.user_email,
        cid: record.contact_cid,
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
