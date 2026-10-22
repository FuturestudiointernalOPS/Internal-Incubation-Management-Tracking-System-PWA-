import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmLeadById } from "@/models/crm/leads";
import { getCrmActivities } from "@/models/crm/activities";
import { addLeadScoreHistory } from "@/models/crm/intelligence";
import { computeLeadScore } from "@/services/crm/leadScoring";
import { fireCrmEvent } from "@/services/crm/automationEngine";

export const dynamic = "force-dynamic";

/**
 * POST /api/crm/leads/[id]/score — compute the lead's score from its recorded
 * facts (crm.edit), store it with a history row, and answer with the breakdown.
 * A manual adjustment stays possible through PATCH /api/crm/leads/[id].
 */
export const POST = createHandler(
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const { id } = await params;
    const session = await getSession();

    const existing = (await getCrmLeadById(id)).rows?.[0];
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "crm.leads.notFound" },
        { status: 404 },
      );
    }

    const activities = (await getCrmActivities({ leadId: id })).rows || [];
    const { score, breakdown } = computeLeadScore(existing, activities);
    const previous = existing.score || 0;

    if (score !== previous) {
      await addLeadScoreHistory({
        leadId: id,
        oldScore: previous,
        newScore: score,
        reason: "Computed from the lead's qualification, status, profile and activity",
        triggerEvent: "computed",
        createdBy: session?.user?.cid,
      });
      await fireCrmEvent(
        "lead.score_changed",
        { ...existing, score, entity_type: "lead" },
        `evt_lead_${id}_${Date.now()}_score`,
        session,
      );
    }

    const lead = (await getCrmLeadById(id)).rows?.[0] ?? { ...existing, score };
    return NextResponse.json({ success: true, lead, breakdown, previousScore: previous });
  },
);
