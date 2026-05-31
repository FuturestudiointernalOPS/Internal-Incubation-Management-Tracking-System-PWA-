import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * REJECT USER ENDPOINT
 * POST /api/admin/reject-user
 *
 * Body: { user_cid }
 *
 * Sets user status to 'rejected' — they cannot proceed further.
 */
export async function POST(req) {
  try {
    await initDb();
    const { user_cid, admin_name } = await req.json();

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "User CID is required." },
        { status: 400 }
      );
    }

    const userResult = await db.execute({
      sql: "SELECT * FROM contacts WHERE cid = ? AND deleted = 0 LIMIT 1",
      args: [user_cid],
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    await db.execute({
      sql: "UPDATE contacts SET status = 'rejected' WHERE cid = ?",
      args: [user_cid],
    });

    // Log to audit_log
    try {
      await db.execute({
        sql: `INSERT INTO audit_log (entity_type, entity_id, user_id, user_name, action, details)
              VALUES ('user', 0, ?, ?, 'rejected', ?)`,
        args: [
          admin_name || "super_admin",
          user_cid,
          `User '${user.name}' (${user.email}) was rejected.`,
        ],
      });
    } catch (e) {
      console.error("Audit log error (non-critical):", e.message);
    }

    // Clear notifications
    try {
      await db.execute({
        sql: `UPDATE v2_notifications
              SET is_read = 1
              WHERE recipient_id = 'sa'
              AND message ILIKE ?
              AND is_read = 0`,
        args: [`%${user.name}%`],
      });
    } catch (e) {
      console.error("Notification clear error:", e.message);
    }

    return NextResponse.json({
      success: true,
      message: `User '${user.name}' has been rejected.`,
    });
  } catch (error) {
    console.error("User rejection error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reject user." },
      { status: 500 }
    );
  }
}
