import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmOpportunityById,
  updateCrmOpportunity,
  softDeleteCrmOpportunity,
} from "@/models/crm/opportunities";
import { getCrmStageHistory } from "@/models/crm/stageHistory";
import { ensureCrmNextActionColumns } from "@/models/crm/schema";
import { addContactTimelineEvent } from "@/services/contacts/timeline";
import {
  touchesNextAction,
  planNextActionWrite,
  nextActionTimelineEvent,
} from "@/services/crm/nextAction";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { id } = await params;

    const [oppResult, historyResult] = await Promise.all([
      getCrmOpportunityById(id),
      getCrmStageHistory(id),
    ]);

    const opp = oppResult.rows?.[0];
    if (!opp) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success:      true,
      opportunity:  opp,
      stageHistory: historyResult.rows,
    });
  },
);

export const PATCH = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const body = await req.json();

    const isAssignment = Object.keys(body).length === 1 && body.owner_cid !== undefined;
    const requiredCap = isAssignment ? "assign" : "edit";

    const authError = await requireAuthorization("crm", requiredCap);
    if (authError) return authError;

    const session = await getSession();
    const actorCid = session?.cid ?? null;

    const existing = await getCrmOpportunityById(id);
    if (!existing.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.notFound" },
        { status: 404 },
      );
    }

    const opp = existing.rows[0];

    // Next action — the owner (or a platform owner) alone may set it.
    const plan = touchesNextAction(body)
      ? planNextActionWrite({ body, existing: opp, session })
      : null;
    if (plan?.error) {
      return NextResponse.json(
        { success: false, error: plan.error },
        { status: plan.status },
      );
    }
    const updates = plan ? { ...body, ...plan.updates } : body;
    if (plan) await ensureCrmNextActionColumns();

    // Probability validation
    if (body.probability != null) {
      const p = parseInt(body.probability);
      if (p < 0 || p > 100) {
        return NextResponse.json(
          { success: false, error: "crm.opportunities.probabilityRange" },
          { status: 400 },
        );
      }
    }

    const result = await updateCrmOpportunity(id, updates);
    const updated = result.rows?.[0] ?? null;

    if (plan && updated?.contact_cid) {
      await addContactTimelineEvent({
        cid: updated.contact_cid,
        eventType: "next_action_set",
        description: nextActionTimelineEvent(plan),
        actorCid,
        metadata: { opportunity_id: id, due: plan.updates.next_action_due ?? null },
      });
    }

    // Timeline logging (person-linked only)
    if (updated && updated.contact_cid) {
      if (body.status && body.status !== opp.status) {
        await addContactTimelineEvent({
          cid: updated.contact_cid,
          eventType: `opportunity_${body.status}`,
          description: `Opportunity ${body.status}: ${updated.name}`,
          actorCid,
          metadata:    { opportunity_id: id, old: opp.status, new: body.status },
        });
      }
      if (body.owner_cid && body.owner_cid !== opp.owner_cid) {
        await addContactTimelineEvent({
          cid: updated.contact_cid,
          eventType: "opportunity_assigned",
          description: `Opportunity reassigned: ${updated.name}`,
          actorCid,
          metadata:    { opportunity_id: id },
        });
      }
    }

    return NextResponse.json({ success: true, opportunity: updated });
  },
);

export const DELETE = createHandler(
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    const { id } = await params;
    const session = await getSession();

    const result = await softDeleteCrmOpportunity(id, session?.cid ?? null);
    if (!result.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
