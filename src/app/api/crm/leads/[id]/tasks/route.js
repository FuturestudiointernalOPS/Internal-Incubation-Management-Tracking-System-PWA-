import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { createTask } from "@/models/tasks/writes";
import { getCrmLeadById } from "@/models/crm/leads";
import { getWeekNumber } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * POST /api/crm/leads/[id]/tasks
 *
 * Creates a native ImpactOS task with context_type='crm_lead' context_id=<leadId>.
 * The task belongs to the existing task system. CRM just provides the link.
 */
export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const { id: leadId } = await params;
    const body = await req.json();
    const session = await getSession();
    const actorCid = session?.user?.cid;

    // Verify the lead exists
    const leadCheck = await getCrmLeadById(leadId);
    if (!leadCheck.rows[0]) {
      return NextResponse.json({ success: false, error: "crm.leads.notFound" }, { status: 404 });
    }

    if (!body.title) {
      return NextResponse.json({ success: false, error: "Task title is required." }, { status: 400 });
    }

    const now = new Date();
    const taskRes = await createTask({
      user_id: actorCid,
      user_name: session?.user?.name || "CRM User",
      title: body.title,
      description: body.description ?? null,
      status: "pending",
      project_id: null,
      category: "crm",
      created_week: getWeekNumber(now),
      created_year: now.getFullYear(),
      carried_over_from_task_id: null,
      parent_task_id: null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      assigned_to: body.assigned_to ?? actorCid,
      link: null,
      priority: body.priority ?? "medium",
      context_type: "crm_lead",
      context_id: leadId,
      supervisor_id: null,
      intent_id: null,
    });

    return NextResponse.json({ success: true, task_id: taskRes.rows[0].id });
  }
);
