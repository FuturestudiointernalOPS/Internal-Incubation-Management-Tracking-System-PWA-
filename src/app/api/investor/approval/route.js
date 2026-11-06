import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireAuthorization } from "@/models/authorization/index";
import { sendStandaloneEmail } from "@/lib/email";
import {
  getInvestorWithContactByProfileId,
  listInvestorsByApprovalStatus,
  notifyInvestorOfApprovalStatus,
  setInvestorApprovalStatus,
  setInvestorReviewNotes,
  markInvestorApprovedAt,
} from "@/models/investorRelations";
import { emitInvestorEvent } from "@/services/investor/activity";
import { getSession } from "@/server/auth/session";

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
    const authError = await requireAuthorization("investor", "edit");
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
    if (action === "approve") {
      await markInvestorApprovedAt(profile_id).catch(() => {});
    }

    // Save review notes if provided
    if (reason) {
      await setInvestorReviewNotes(profile_id, reason);
    }

    // Get investor with contact info for notification
    const investorResult = await getInvestorWithContactByProfileId(profile_id);
    const session = await getSession();

    const investorRow = investorResult.rows[0];
    const eventType = action === "approve"
      ? "application_approved"
      : action === "reject"
        ? "application_rejected"
        : null;
    if (eventType) {
      await emitInvestorEvent({
        session,
        investorId: profile_id,
        eventType,
        actorType: "studio",
        metadata: { reason: reason || null, status: newStatus },
      }).catch(() => {});
    }

    if (investorRow && investorRow.email) {
      const statusLabels = { approved: "approved", rejected: "rejected", suspended: "suspended" };
      try {
        await sendStandaloneEmail({
          to: investorRow.email,
          subject: `Investor Account ${statusLabels[newStatus]}`,
          email_type: "investor_decision",
          contact_cid: investorRow.user_id,
          body: `Hello ${investorRow.name || ""},\n\nYour investor account has been ${statusLabels[newStatus]}${reason ? `.\n\nReason: ${reason}` : "."}\n\n${newStatus === "approved" ? "You can now access Investor OS at " + (await import("@/lib/appUrl")).resolveAppUrl() + "/login" : "Please contact Future Studio for more information."}\n\n— Future Studio Team`,
        });
        if (action === "approve") {
          await emitInvestorEvent({
            session,
            investorId: profile_id,
            eventType: "activation_email_sent",
            actorType: "system",
            metadata: { email: investorRow.email },
          }).catch(() => {});
        }
      } catch (_) {}

      // Create notification
      try {
        await notifyInvestorOfApprovalStatus(
          investorRow.user_id,
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
