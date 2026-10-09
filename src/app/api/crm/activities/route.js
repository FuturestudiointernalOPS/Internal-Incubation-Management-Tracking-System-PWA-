import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmActivities, createCrmActivity } from "@/models/crm/activities";
import { createTask } from "@/models/tasks/writes";
import { sendAndRecord } from "@/lib/email/delivery";
import { getWeekNumber } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Mirrors the crm_activities.type CHECK constraint so a bad payload is a
// clean 400 instead of a database error surfaced as a 500.
const CRM_ACTIVITY_TYPES = ["call", "meeting", "email", "note", "follow_up", "task", "other"];

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    
    const result = await getCrmActivities({
      leadId: searchParams.get("lead_id"),
      opportunityId: searchParams.get("opportunity_id"),
      contactCid: searchParams.get("contact_cid"),
      organizationId: searchParams.get("organization_id"),
    });

    return NextResponse.json({ success: true, activities: result.rows });
  }
);

export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const body = await req.json();
    const session = await getSession();
    const actorCid = session?.user?.cid;

    if (!body.type) {
      return NextResponse.json({ success: false, error: "Type is required" }, { status: 400 });
    }

    if (!CRM_ACTIVITY_TYPES.includes(body.type)) {
      return NextResponse.json({ success: false, error: "Unsupported activity type" }, { status: 400 });
    }

    if (!body.title || !String(body.title).trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    if (!body.lead_id && !body.opportunity_id && !body.contact_cid && !body.organization_id) {
      return NextResponse.json({ success: false, error: "CRM context is required" }, { status: 400 });
    }

    // Context mapping for polymorphic CRM structures
    const contextType = body.lead_id ? 'crm_lead' :
                        body.opportunity_id ? 'crm_opportunity' :
                        body.organization_id ? 'crm_organization' :
                        body.contact_cid ? 'crm_contact' : 'staff';
    const contextId = body.lead_id || body.opportunity_id || body.organization_id || body.contact_cid;

    // Route 1: TASKS
    // Creating a CRM task creates an actual native ImpactOS task with a CRM context.
    if (body.type === "task") {
      const now = new Date();
      const taskRes = await createTask({
        user_id: actorCid,
        user_name: session?.user?.name || "CRM User",
        title: body.title,
        description: body.description,
        status: "pending", // Default native status
        project_id: null,
        category: "crm",
        created_week: getWeekNumber(now),
        created_year: now.getFullYear(),
        start_date: null,
        end_date: body.activity_date || null,
        assigned_to: body.owner_cid || actorCid,
        priority: "medium",
        context_type: contextType,
        context_id: contextId,
      });

      return NextResponse.json({ success: true, task_id: taskRes.rows[0].id });
    }

    // Route 2: EMAILS
    // Creating a CRM email actually sends a platform email, and logs a CRM activity reference
    if (body.type === "email") {
      if (!body.email_to) {
        return NextResponse.json({ success: false, error: "Recipient email is required" }, { status: 400 });
      }
      
      // Dispatch via existing delivery subsystem
      await sendAndRecord({
        to: body.email_to,
        subject: body.title,
        html: `<div style="font-family:sans-serif;">${body.description || ""}</div>`,
        fromName: session?.user?.name || "Future Studio CRM",
        provider: null, // Let platform choose
        contact_cid: body.contact_cid || null,
        email_type: "crm_communication",
        note: `CRM Context: ${contextType} ${contextId}`,
        attachments: []
      });
      
      // Also log the activity locally for unified UI timelines
      const activityRes = await createCrmActivity({
        type: "email",
        title: body.title,
        description: body.description,
        outcome: "sent",
        activity_date: new Date().toISOString(),
        lead_id: body.lead_id,
        opportunity_id: body.opportunity_id,
        contact_cid: body.contact_cid,
        organization_id: body.organization_id,
        owner_cid: actorCid,
        reference_id: null, // sendAndRecord doesn't return log ID
        created_by: actorCid,
      });

      return NextResponse.json({ success: true, activity: activityRes.rows[0] });
    }

    // Route 3: MEETINGS, CALLS, NOTES, FOLLOW-UPS
    // Stored natively in crm_activities to avoid polluting highly constrained domains (like v2_events)
    // with parameterless CRM activities. The unified calendar picks them up automatically.
    const activityRes = await createCrmActivity({
      type: body.type,
      title: body.title,
      description: body.description,
      outcome: body.outcome,
      activity_date: body.activity_date,
      lead_id: body.lead_id,
      opportunity_id: body.opportunity_id,
      contact_cid: body.contact_cid,
      organization_id: body.organization_id,
      owner_cid: body.owner_cid || actorCid,
      created_by: actorCid,
    });

    return NextResponse.json({ success: true, activity: activityRes.rows[0] });
  }
);
