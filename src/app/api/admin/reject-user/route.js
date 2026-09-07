import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  getUserForRejection,
  insertRejectionAuditLog,
  markRejectionUserNotificationsRead,
  rejectContact,
} from "@/models/adminOps";

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
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const { user_cid, admin_name } = await req.json();

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "User CID is required." },
        { status: 400 },
      );
    }

    const userResult = await getUserForRejection(user_cid);

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );
    }

    const user = userResult.rows[0];

    await rejectContact(user_cid);

    // Log to audit_log
    try {
      await insertRejectionAuditLog({
        adminName: admin_name,
        userCid: user_cid,
        userName: user.name,
        userEmail: user.email,
      });
    } catch (e) {
      console.error("Audit log error (non-critical):", e.message);
    }

    // Clear notifications
    try {
      await markRejectionUserNotificationsRead(user.name);
    } catch (e) {
      console.error("Notification clear error:", e.message);
    }

    return NextResponse.json({
      success: true,
      message: `User '${user.name}' has been rejected.`,
    });
  } catch (e) {
    console.error("API Error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
