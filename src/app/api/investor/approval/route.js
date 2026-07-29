import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";

/** GET /api/investor/approval — list investors by status (admin only) */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    let sql = `SELECT ip.*, c.name, c.email, c.status as contact_status, c.created_at as joined_at
               FROM investor_profiles ip
               JOIN contacts c ON ip.user_id = c.cid
               WHERE 1=1`;
    const args = [];

    if (status !== "all") {
      sql += " AND ip.approval_status = ?";
      args.push(status);
    }
    if (search) {
      sql += " AND (c.name ILIKE ? OR c.email ILIKE ? OR ip.organization_name ILIKE ?)";
      const q = `%${search}%`;
      args.push(q, q, q);
    }

    sql += " ORDER BY ip.created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, investors: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/approval — approve/reject/suspend */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { profile_id, action, reason } = await req.json();

    if (!profile_id || !action) {
      return NextResponse.json({ success: false, error: "profile_id and action required" }, { status: 400 });
    }

    const validActions = ["approve", "reject", "suspend"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const statusMap = { approve: "approved", reject: "rejected", suspend: "suspended" };
    const newStatus = statusMap[action];

    // Update profile
    await db.execute({
      sql: "UPDATE investor_profiles SET approval_status = ?, updated_at = NOW() WHERE id = ?",
      args: [newStatus, profile_id],
    });

    // Save review notes if provided
    if (reason) {
      await db.execute({
        sql: "UPDATE investor_profiles SET review_notes = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?",
        args: [reason, profile_id],
      });
    }

    // Get investor with contact info for notification
    const investor = await db.execute({
      sql: `SELECT ip.*, c.name, c.email FROM investor_profiles ip
            JOIN contacts c ON ip.user_id = c.cid WHERE ip.id = ?`,
      args: [profile_id],
    });

    const inv = investor.rows[0];
    if (inv && inv.email) {
      const statusLabels = { approved: "approved", rejected: "rejected", suspended: "suspended" };
      try {
        await sendEmail({
          to: inv.email,
          subject: `Investor Account ${statusLabels[newStatus]}`,
          body: `Hello ${inv.name || ""},\n\nYour investor account has been ${statusLabels[newStatus]}${reason ? `.\n\nReason: ${reason}` : "."}\n\n${newStatus === "approved" ? "You can now access Investor OS at " + process.env.NEXT_PUBLIC_APP_URL + "/investor/dashboard" : "Please contact Future Studio for more information."}`,
        });
      } catch (_) {}

      // Create notification
      try {
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'investor', 0, NOW())`,
          args: [
            inv.user_id,
            `Investor Account ${statusLabels[newStatus]}`,
            `Your investor account has been ${statusLabels[newStatus]}.${newStatus === "approved" ? " Welcome to Investor OS!" : ""}`,
          ],
        });
      } catch (_) {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
