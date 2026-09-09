import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  addInvestmentToActiveCampaign,
  createInvestmentDecision,
  getInvestmentNotificationInfo,
  getInvestorProfileIdByUserId,
  getInvestorProfileIdByUserIdForPipelineList,
  getMeetingRequestInfo,
  getRelationshipWorkspaceAssigneesForInvestment,
  getRelationshipWorkspaceIdForInvestment,
  insertInvestmentCommittedTimeline,
  insertInvestmentConfirmedAdminNotification,
  insertInvestmentConfirmedInvestorNotification,
  insertInvestmentConfirmedStaffNotification,
  insertInvestorMeetingPlaceholderEvent,
  insertInvestorMeetingRequestNotification,
  listAdminAndStaffCids,
  listInvestmentPipeline,
  listSuperAdminCids,
  markRelationshipWorkspaceActiveInvestment,
  upsertInvestmentPipeline,
} from "@/models/investor";

/** POST /api/investor/pipeline — add venture to pipeline or update stage */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const session = await getSession();
    const user = session;
    const { venture_id, stage, notes, amount } = await req.json();

    if (!venture_id) {
      return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });
    }

    // Get investor profile
    const profile = await getInvestorProfileIdByUserId(user.cid || user.id);
    if (profile.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Investor profile not found" }, { status: 404 });
    }

    const investorId = profile.rows[0].id;
    const validStages = ["interested", "watching", "meeting_requested", "due_diligence", "negotiation", "invested", "declined"];
    const newStage = stage || "interested";

    if (!validStages.includes(newStage)) {
      return NextResponse.json({ success: false, error: "Invalid stage" }, { status: 400 });
    }

    // Upsert pipeline entry
    const result = await upsertInvestmentPipeline({ investor_id: investorId, venture_id, stage: newStage, notes });

    // If stage is "meeting_requested", notify admin + create calendar placeholder
    if (newStage === "meeting_requested") {
      try {
        // Get investor and venture names
        const info = await getMeetingRequestInfo({ venture_id, investor_id: investorId });
        const inv = info.rows[0] || {};

        // Notify super admins
        const admins = await listSuperAdminCids();
        for (const a of admins.rows) {
          await insertInvestorMeetingRequestNotification({
            recipient_id: a.cid,
            investor_name: inv.investor_name,
            organization_name: inv.organization_name,
            venture_name: inv.venture_name,
            notes,
            link: "/admin/investors/overview",
          });
        }

        // Create calendar placeholder event
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        await insertInvestorMeetingPlaceholderEvent({
          program_id: venture_id,
          venture_name: inv.venture_name,
          investor_name: inv.investor_name,
          organization_name: inv.organization_name,
          start_time: nextWeek.toISOString(),
          end_time: nextWeek.toISOString(),
          created_by: user.cid || user.id,
        });
      } catch (_) {}
    }

    // If stage is "invested", auto-create decision, update campaign, portfolio
    if (newStage === "invested") {
      const pipelineId = result.rows[0].id;
      const investedAmount = parseFloat(amount || notes) || 0;

      const decisionRes = await createInvestmentDecision({ pipeline_id: pipelineId, investment_amount: investedAmount, notes });

      // Update fundraising campaign current_raised
      if (investedAmount > 0) {
        try {
          await addInvestmentToActiveCampaign({ amount: investedAmount, venture_id });
        } catch (_) {}
      }

      // Timeline entry in relationship workspace
      try {
        const relWs = await getRelationshipWorkspaceIdForInvestment(pipelineId);
        if (relWs.rows.length > 0) {
          await insertInvestmentCommittedTimeline({ workspace_id: relWs.rows[0].id, investment_amount: investedAmount });
          // Update workspace stage
          await markRelationshipWorkspaceActiveInvestment(relWs.rows[0].id);
        }
      } catch (_) {}

      // Notify everyone
      try {
        const info = await getInvestmentNotificationInfo({ venture_id, investor_id: investorId });
        const inv = info.rows[0] || {};

        // Notify admins
        const admins = await listAdminAndStaffCids();
        for (const a of admins.rows) {
          await insertInvestmentConfirmedAdminNotification({
            recipient_id: a.cid,
            investor_name: inv.investor_name,
            organization_name: inv.organization_name,
            venture_name: inv.venture_name,
            investment_amount: investedAmount,
            link: "/admin/investors/overview",
          });
        }

        // Notify investor
        if (inv.user_id) {
          await insertInvestmentConfirmedInvestorNotification({
            recipient_id: inv.user_id,
            venture_name: inv.venture_name,
            investment_amount: investedAmount,
            link: "/investor/portfolio",
          });
        }

        // Notify RM and IM
        const relWs = await getRelationshipWorkspaceAssigneesForInvestment(pipelineId);
        if (relWs.rows.length > 0) {
          const rw = relWs.rows[0];
          for (const cid of [rw.relationship_manager_id, rw.investment_manager_id]) {
            if (cid) {
              await insertInvestmentConfirmedStaffNotification({
                recipient_id: cid,
                investor_name: inv.investor_name,
                venture_name: inv.venture_name,
                investment_amount: investedAmount,
                link: "/admin/investors/relationships",
              });
            }
          }
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, pipeline: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** GET /api/investor/pipeline — list pipeline for current investor or by venture */
export async function GET(req) {
  try {
    await initDb();
    // Phase 1.5: authentication only — scoping is derived below.
    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    const stage = searchParams.get("stage");

    const session = await getSession();
    const user = session;
    const management = ["super_admin", "staff", "program_manager"].includes(user?.role);

    // Phase 1.5: every non-management session is OWN-SCOPED — the investor
    // profile is resolved and bound regardless of filters, so a venture_id can
    // no longer expose other investors' rows and the admin stage filter stays
    // management-only. Management keeps its historical branches.
    let investorId = null;
    if (!management) {
      const profile = await getInvestorProfileIdByUserIdForPipelineList(user.cid || user.id);
      if (profile.rows.length === 0) {
        return NextResponse.json({ success: true, pipeline: [] });
      }
      investorId = profile.rows[0].id;
    } else if (!ventureId && !(stage && (user.role === "super_admin" || user.role === "staff"))) {
      const profile = await getInvestorProfileIdByUserIdForPipelineList(user.cid || user.id);
      if (profile.rows.length === 0) {
        return NextResponse.json({ success: true, pipeline: [] });
      }
      investorId = profile.rows[0].id;
    }

    const result = await listInvestmentPipeline({ ventureId, stage, role: user.role, investorId });
    return NextResponse.json({ success: true, pipeline: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
