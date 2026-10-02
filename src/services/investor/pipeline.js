/**
 * Investor service — the investment pipeline.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the list scope, the
 * valid stages, the invested-amount parsing, and the two best-effort side
 * effects (the meeting request, and the "invested" cascade). Every statement
 * lives in `@/models/investor`. No SQL, no HTTP.
 */

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

// The internal roles that see every pipeline row.
const MANAGEMENT_ROLES = ["super_admin", "staff", "program_manager"];

export const PIPELINE_STAGES = [
  "interested",
  "watching",
  "meeting_requested",
  "due_diligence",
  "negotiation",
  "invested",
  "declined",
];

/** The stage to store, defaulting to "interested". */
export function normalizePipelineStage(stage) {
  return stage || "interested";
}

/** The invested amount, read from the amount field or, failing that, the notes. */
export function parseInvestedAmount({ amount, notes }) {
  return parseFloat(amount || notes) || 0;
}

/**
 * Whether the caller's investor profile must be resolved to scope the list.
 *
 * Every non-management session is OWN-SCOPED — the profile is resolved and bound
 * regardless of filters, so a venture id can no longer expose other investors'
 * rows. Management keeps its historical branches: with no venture id and no
 * super-admin/staff stage filter, it too falls back to its own profile.
 */
export function shouldResolvePipelineProfile({ management, ventureId, stage, role }) {
  if (!management) return true;
  return !ventureId && !(stage && (role === "super_admin" || role === "staff"));
}

/** The pipeline rows a caller may list. */
export async function listPipelineForViewer({ ventureId, stage, session }) {
  const management = MANAGEMENT_ROLES.includes(session?.role);
  let investorId = null;

  if (shouldResolvePipelineProfile({ management, ventureId, stage, role: session?.role })) {
    const profileResult = await getInvestorProfileIdByUserIdForPipelineList(
      session.cid || session.id,
    );
    if (profileResult.rows.length === 0) return { ok: true, pipeline: [] };
    investorId = profileResult.rows[0].id;
  }

  const result = await listInvestmentPipeline({
    ventureId,
    stage,
    role: session.role,
    investorId,
  });
  return { ok: true, pipeline: result.rows };
}

/**
 * Add a venture to the caller's pipeline, or move its stage — then run the two
 * best-effort cascades: a meeting request notifies the super admins and drops a
 * calendar placeholder; "invested" records the decision, updates the campaign,
 * marks the relationship workspace and notifies everyone. A notification or
 * timeline failure never blocks the pipeline write.
 */
export async function addOrUpdatePipeline({ ventureId, stage, notes, amount, session }) {
  const profileResult = await getInvestorProfileIdByUserId(session.cid || session.id);
  if (profileResult.rows.length === 0) {
    return { ok: false, status: 404, error: "Investor profile not found" };
  }
  const investorId = profileResult.rows[0].id;

  const newStage = normalizePipelineStage(stage);
  if (!PIPELINE_STAGES.includes(newStage)) {
    return { ok: false, status: 400, error: "Invalid stage" };
  }

  const result = await upsertInvestmentPipeline({
    investor_id: investorId,
    venture_id: ventureId,
    stage: newStage,
    notes,
  });

  // Meeting requested → notify super admins and drop a calendar placeholder.
  if (newStage === "meeting_requested") {
    try {
      const meetingRequestInfo = await getMeetingRequestInfo({
        venture_id: ventureId,
        investor_id: investorId,
      });
      const investorInfo = meetingRequestInfo.rows[0] || {};

      const admins = await listSuperAdminCids();
      for (const admin of admins.rows) {
        await insertInvestorMeetingRequestNotification({
          recipient_id: admin.cid,
          investor_name: investorInfo.investor_name,
          organization_name: investorInfo.organization_name,
          venture_name: investorInfo.venture_name,
          notes,
          link: "/admin/investors/overview",
        });
      }

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      await insertInvestorMeetingPlaceholderEvent({
        program_id: ventureId,
        venture_name: investorInfo.venture_name,
        investor_name: investorInfo.investor_name,
        organization_name: investorInfo.organization_name,
        start_time: nextWeek.toISOString(),
        end_time: nextWeek.toISOString(),
        created_by: session.cid || session.id,
      });
    } catch (_) {}
  }

  // Invested → record the decision, update the campaign, the workspace and notify.
  if (newStage === "invested") {
    const pipelineId = result.rows[0].id;
    const investedAmount = parseInvestedAmount({ amount, notes });

    await createInvestmentDecision({
      pipeline_id: pipelineId,
      investment_amount: investedAmount,
      notes,
    });

    if (investedAmount > 0) {
      try {
        await addInvestmentToActiveCampaign({ amount: investedAmount, venture_id: ventureId });
      } catch (_) {}
    }

    try {
      const relationshipWorkspaceResult =
        await getRelationshipWorkspaceIdForInvestment(pipelineId);
      if (relationshipWorkspaceResult.rows.length > 0) {
        await insertInvestmentCommittedTimeline({
          workspace_id: relationshipWorkspaceResult.rows[0].id,
          investment_amount: investedAmount,
        });
        await markRelationshipWorkspaceActiveInvestment(relationshipWorkspaceResult.rows[0].id);
      }
    } catch (_) {}

    try {
      const notificationInfo = await getInvestmentNotificationInfo({
        venture_id: ventureId,
        investor_id: investorId,
      });
      const investorInfo = notificationInfo.rows[0] || {};

      const admins = await listAdminAndStaffCids();
      for (const admin of admins.rows) {
        await insertInvestmentConfirmedAdminNotification({
          recipient_id: admin.cid,
          investor_name: investorInfo.investor_name,
          organization_name: investorInfo.organization_name,
          venture_name: investorInfo.venture_name,
          investment_amount: investedAmount,
          link: "/admin/investors/overview",
        });
      }

      if (investorInfo.user_id) {
        await insertInvestmentConfirmedInvestorNotification({
          recipient_id: investorInfo.user_id,
          venture_name: investorInfo.venture_name,
          investment_amount: investedAmount,
          link: "/investor/portfolio",
        });
      }

      const relationshipWorkspaceResult =
        await getRelationshipWorkspaceAssigneesForInvestment(pipelineId);
      if (relationshipWorkspaceResult.rows.length > 0) {
        const relationshipWorkspace = relationshipWorkspaceResult.rows[0];
        for (const cid of [
          relationshipWorkspace.relationship_manager_id,
          relationshipWorkspace.investment_manager_id,
        ]) {
          if (cid) {
            await insertInvestmentConfirmedStaffNotification({
              recipient_id: cid,
              investor_name: investorInfo.investor_name,
              venture_name: investorInfo.venture_name,
              investment_amount: investedAmount,
              link: "/admin/investors/relationships",
            });
          }
        }
      }
    } catch (_) {}
  }

  return { ok: true, pipeline: result.rows[0] };
}
