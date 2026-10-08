import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmLeads, createCrmLead } from "@/models/crm/leads";
import { addContactTimelineEvent } from "@/services/contacts/timeline";

export const dynamic = "force-dynamic";

/**
 * CRM Leads API
 * 
 * GET  /api/crm/leads — list leads (crm.view)
 * POST /api/crm/leads — create a new lead (crm.create)
 */

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ownerCid = searchParams.get("owner_cid") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const leadType = searchParams.get("lead_type") ?? undefined;
    const qualification = searchParams.get("qualification") ?? undefined;

    const result = await getCrmLeads({ ownerCid, status, leadType, qualification });

    return NextResponse.json({
      success: true,
      leads: result.rows,
    });
  }
);

export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "create");
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();

    const title = (body.title ?? "").trim();
    if (!title) {
      return NextResponse.json(
        { success: false, error: "crm.leads.titleRequired" },
        { status: 400 }
      );
    }

    if (!body.contact_cid && !body.organization_id) {
      return NextResponse.json(
        { success: false, error: "crm.leads.targetRequired" },
        { status: 400 }
      );
    }

    const result = await createCrmLead({
      title,
      contact_cid:         body.contact_cid ?? null,
      organization_id:     body.organization_id ?? null,
      owner_cid:           body.owner_cid ?? session?.user?.cid ?? null,
      lead_type:           body.lead_type ?? 'other',
      status:              body.status ?? 'new',
      qualification_state: body.qualification_state ?? 'not_assessed',
      source:              body.source ?? null,
      description:         body.description ?? null,
      notes:               body.notes ?? null,
      created_by:          session?.user?.cid ?? null,
    });

    const lead = result.rows?.[0];

    // Optional: Log to existing contact timeline if attached to a person
    if (lead && lead.contact_cid) {
      await addContactTimelineEvent({
        cid: lead.contact_cid,
        eventType: "lead_created",
        description: `Lead created: ${lead.title}`,
        actorCid: session?.user?.cid ?? null,
        metadata: { lead_id: lead.id, lead_type: lead.lead_type },
      });
    }

    return NextResponse.json({ success: true, lead }, { status: 201 });
  }
);
