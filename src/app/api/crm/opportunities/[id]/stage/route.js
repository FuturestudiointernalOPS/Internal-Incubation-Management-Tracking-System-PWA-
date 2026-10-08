import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmOpportunityById,
  setCrmOpportunityStage,
} from "@/models/crm/opportunities";
import {
  getCrmStageById,
} from "@/models/crm/pipelines";
import { appendCrmStageHistory } from "@/models/crm/stageHistory";
import { addContactTimelineEvent } from "@/services/contacts/timeline";

export const dynamic = "force-dynamic";

/**
 * Stage movement — the single authoritative path for changing a CRM Opportunity's stage.
 *
 * PATCH /api/crm/opportunities/[id]/stage
 * Body: { stage_id, note? }
 *
 * This endpoint:
 *   1. Authenticates and authorizes (crm.edit)
 *   2. Validates the new stage belongs to the same pipeline as the opportunity
 *   3. Updates the opportunity's current stage_id
 *   4. Derives status from stage terminal/outcome flags
 *   5. Appends a stage history record (append-only)
 *   6. Writes a timeline event if tied to a contact
 *   7. Returns the updated opportunity
 *
 * No frontend-only stage update path exists. All stage changes use this endpoint.
 */
export const PATCH = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();
    const session = await getSession();
    const actorCid = session?.user?.cid ?? null;

    const newStageId = body.stage_id ?? null;
    if (!newStageId) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.stageRequired" },
        { status: 400 },
      );
    }

    // Load existing opportunity
    const existing = await getCrmOpportunityById(id);
    const opp = existing.rows?.[0];
    if (!opp) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.notFound" },
        { status: 404 },
      );
    }

    // Validate new stage belongs to the SAME pipeline as the opportunity
    const stageResult = await getCrmStageById(newStageId);
    const newStage = stageResult.rows?.[0];

    if (!newStage) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.stageNotFound" },
        { status: 404 },
      );
    }

    if (newStage.pipeline_id !== opp.pipeline_id) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.stagePipelineMismatch" },
        { status: 400 },
      );
    }

    // Derive status from terminal stage flags
    let newStatus = opp.status;
    if (newStage.is_terminal) {
      newStatus = newStage.outcome === "won" ? "won" : "lost";
    } else {
      // Moving back to a non-terminal stage reopens the opportunity
      if (opp.status === "won" || opp.status === "lost") {
        newStatus = "active";
      }
    }

    // Update stage + status
    const updateResult = await setCrmOpportunityStage(id, newStageId, newStatus);
    const updated = updateResult.rows?.[0];

    // Append stage history — always, unconditionally, append-only
    await appendCrmStageHistory({
      opportunity_id: id,
      from_stage_id:  opp.stage_id,
      to_stage_id:    newStageId,
      changed_by:     actorCid,
      metadata: {
        from_stage_name: opp.stage_name ?? null,
        to_stage_name:   newStage.name,
        new_status:      newStatus,
        note:            body.note ?? null,
      },
    });

    // Timeline: only if tied to a person
    if (updated?.contact_cid) {
      await addContactTimelineEvent({
        cid: updated.contact_cid,
        eventType: "opportunity_stage_changed",
        description: `Opportunity moved to ${newStage.name}: ${opp.name}`,
        actorCid,
        metadata: {
          opportunity_id:  id,
          from_stage:      opp.stage_name ?? null,
          to_stage:        newStage.name,
          new_status:      newStatus,
        },
      });
    }

    return NextResponse.json({ success: true, opportunity: updated });
  },
);
