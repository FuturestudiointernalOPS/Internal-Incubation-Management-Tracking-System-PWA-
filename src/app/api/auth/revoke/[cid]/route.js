import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/revoke/:cid
 *
 * Revokes a user's access by setting status to 'inactive'
 * and deleting all active sessions.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { cid } = await params;

    const contactRes = await db.execute({
      sql: "SELECT cid FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (contactRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    // Set status to inactive
    await db.execute({
      sql: "UPDATE contacts SET status = 'inactive' WHERE cid = ?",
      args: [cid],
    });

    // Delete all active sessions
    await db.execute({
      sql: "DELETE FROM user_sessions WHERE user_cid = ?",
      args: [cid],
    });

    return NextResponse.json({
      success: true,
      message: "Access revoked. User sessions destroyed.",
    });
  } catch (error) {
    console.error("Revoke error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
