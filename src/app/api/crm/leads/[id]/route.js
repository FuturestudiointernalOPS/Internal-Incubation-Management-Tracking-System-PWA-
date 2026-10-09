import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmLeadById, updateCrmLead, softDeleteCrmLead } from "@/models/crm/leads";
import { addContactTimelineEvent } from "@/services/contacts/timeline";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { id } = await params;
    const result = await getCrmLeadById(id);

    const lead = result.rows?.[0];
    if (!lead) {
      return NextResponse.json(
        { success: false, error: "crm.leads.notFound" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, lead });
  }
);

export const PATCH = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const { id } = await params;
    const body = await req.json();
    const session = await getSession();

    // Differentiate between generic edit and assignment
    const isAssignment = Object.keys(body).length === 1 && body.owner_cid !== undefined;

    // Literal guards on purpose: the route-catalog contract scans for
    // requireAuthorization("crm", "…") literals, and a capability held in a
    // variable would hide crm.assign from that floor check.
    const authError = isAssignment
      ? await requireAuthorization("crm", "assign")
      : await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const existing = await getCrmLeadById(id);
    const existingLead = existing.rows?.[0];
    
    if (!existingLead) {
      return NextResponse.json(
        { success: false, error: "crm.leads.notFound" },
        { status: 404 }
      );
    }

    const result = await updateCrmLead(id, body);
    const updatedLead = result.rows?.[0];

    // Log meaningful changes to the timeline if attached to a person
    if (updatedLead) {
      if (updatedLead.contact_cid) {
        if (body.status && body.status !== existingLead.status) {
          await addContactTimelineEvent({
            cid: updatedLead.contact_cid,
            eventType: "lead_status_changed",
            description: `Lead status changed to ${body.status}`,
            actorCid: session?.user?.cid ?? null,
            metadata: { lead_id: id, old: existingLead.status, new: body.status },
          });
        }
        if (body.owner_cid && body.owner_cid !== existingLead.owner_cid) {
          await addContactTimelineEvent({
            cid: updatedLead.contact_cid,
            eventType: "lead_assigned",
            description: `Lead reassigned`,
            actorCid: session?.user?.cid ?? null,
            metadata: { lead_id: id, new_owner: body.owner_cid },
          });
        }
      }

      // -------------------------------------------------------------------------
      // Phase 5 Intelligence: Automation Triggers & Score History
      // -------------------------------------------------------------------------
      const ctx = { ...updatedLead, entity_type: 'lead' };
      const eventIdBase = `evt_lead_${id}_${Date.now()}`;

      // Score History
      if (body.score !== undefined && body.score !== existingLead.score) {
        const { addLeadScoreHistory } = await import("@/models/crm/intelligence");
        await addLeadScoreHistory({
          leadId: id,
          oldScore: existingLead.score || 0,
          newScore: body.score,
          reason: body.qualification_reason || "Score updated manually",
          triggerEvent: "manual",
          createdBy: session?.user?.cid
        });
        
        const { fireCrmEvent } = await import("@/services/crm/automationEngine");
        await fireCrmEvent("lead.score_changed", ctx, `${eventIdBase}_score`, session);
      }

      // Qualification
      if (body.qualification_state && body.qualification_state !== existingLead.qualification_state) {
        const { fireCrmEvent } = await import("@/services/crm/automationEngine");
        await fireCrmEvent(
          body.qualification_state === 'qualified' ? "lead.qualified" : 
          body.qualification_state === 'unqualified' ? "lead.disqualified" : 
          "lead.qualification_changed", 
          ctx, 
          `${eventIdBase}_qual`, 
          session
        );
      }

      // Assignment
      if (body.owner_cid && body.owner_cid !== existingLead.owner_cid) {
        const { fireCrmEvent } = await import("@/services/crm/automationEngine");
        await fireCrmEvent("lead.assigned", ctx, `${eventIdBase}_assign`, session);
      }
    }

    return NextResponse.json({ success: true, lead: updatedLead });
  }
);

export const DELETE = createHandler(
  { roles: ["super_admin"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    const { id } = await params;
    const session = await getSession();

    const result = await softDeleteCrmLead(id, session?.user?.cid ?? null);
    if (!result.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.leads.notFound" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  }
);
