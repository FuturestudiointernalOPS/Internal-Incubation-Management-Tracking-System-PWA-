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
import { addContactTimelineEvent } from "@/services/contacts/timeline";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
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
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const { id } = await params;
    const body = await req.json();

    const isAssignment = Object.keys(body).length === 1 && body.owner_cid !== undefined;
    const requiredCap = isAssignment ? "assign" : "edit";

    const authError = await requireAuthorization("crm", requiredCap);
    if (authError) return authError;

    const session = await getSession();
    const actorCid = session?.user?.cid ?? null;

    const existing = await getCrmOpportunityById(id);
    if (!existing.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.notFound" },
        { status: 404 },
      );
    }

    const opp = existing.rows[0];

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

    const result = await updateCrmOpportunity(id, body);
    const updated = result.rows?.[0] ?? null;

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
  { roles: ["super_admin"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    const { id } = await params;
    const session = await getSession();

    const result = await softDeleteCrmOpportunity(id, session?.user?.cid ?? null);
    if (!result.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
