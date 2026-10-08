import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmLeadById, updateCrmLead, softDeleteCrmLead } from "@/models/crm/leads";
import { createContactTimelineEvent } from "@/models/contacts/timeline";

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
    const requiredCap = isAssignment ? "assign" : "edit";
    
    const authError = await requireAuthorization("crm", requiredCap);
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
    if (updatedLead && updatedLead.contact_cid) {
      if (body.status && body.status !== existingLead.status) {
        await createContactTimelineEvent({
          contact_cid: updatedLead.contact_cid,
          event_type: "lead_status_changed",
          description: `Lead status changed to ${body.status}`,
          metadata: { lead_id: id, old: existingLead.status, new: body.status },
          actor_cid: session?.user?.cid ?? null,
        });
      }
      if (body.owner_cid && body.owner_cid !== existingLead.owner_cid) {
        await createContactTimelineEvent({
          contact_cid: updatedLead.contact_cid,
          event_type: "lead_assigned",
          description: `Lead reassigned`,
          metadata: { lead_id: id, new_owner: body.owner_cid },
          actor_cid: session?.user?.cid ?? null,
        });
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
