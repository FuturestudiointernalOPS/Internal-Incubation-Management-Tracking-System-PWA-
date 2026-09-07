import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";
import {
  getInvestorWithContactByProfileId,
  listInvestorsByApprovalStatus,
  notifyInvestorOfApprovalStatus,
  setInvestorApprovalStatus,
  setInvestorReviewNotes,
} from "@/models/investorRelations";

/** GET /api/investor/approval — list investors by status (admin only) */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    const result = await listInvestorsByApprovalStatus({ status, search });
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
    await setInvestorApprovalStatus(profile_id, newStatus);

    // Save review notes if provided
    if (reason) {
      await setInvestorReviewNotes(profile_id, reason);
    }

    // Get investor with contact info for notification
    const investor = await getInvestorWithContactByProfileId(profile_id);

    const inv = investor.rows[0];
    if (inv && inv.email) {
      const statusLabels = { approved: "approved", rejected: "rejected", suspended: "suspended" };
      try {
        await sendEmail({
          to: inv.email,
          subject: `Investor Account ${statusLabels[newStatus]}`,
          body: `Hello ${inv.name || ""},\n\nYour investor account has been ${statusLabels[newStatus]}${reason ? `.\n\nReason: ${reason}` : "."}\n\n${newStatus === "approved" ? "You can now access Investor OS at " + (await import("@/lib/appUrl")).resolveAppUrl() + "/login" : "Please contact Future Studio for more information."}\n\n— Future Studio Team`,
        });
      } catch (_) {}

      // Create notification
      try {
        await notifyInvestorOfApprovalStatus(
          inv.user_id,
          `Investor Account ${statusLabels[newStatus]}`,
          `Your investor account has been ${statusLabels[newStatus]}.${newStatus === "approved" ? " Welcome to Investor OS!" : ""}`,
        );
      } catch (_) {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
