import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { createTask } from "@/models/tasks/writes";
import { getCrmOpportunityById } from "@/models/crm/opportunities";
import { getWeekNumber } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * POST /api/crm/opportunities/[id]/tasks
 *
 * Creates a native ImpactOS task with context_type='crm_opportunity'.
 * Task is owned by the existing task system; CRM reads it through
 * the context link.
 */
export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const { id: opportunityId } = await params;
    const body = await req.json();
    const session = await getSession();
    const actorCid = session?.user?.cid;

    // Verify the opportunity exists
    const oppCheck = await getCrmOpportunityById(opportunityId);
    if (!oppCheck.rows[0]) {
      return NextResponse.json({ success: false, error: "crm.opportunities.notFound" }, { status: 404 });
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
      context_type: "crm_opportunity",
      context_id: opportunityId,
      supervisor_id: null,
      intent_id: null,
    });

    return NextResponse.json({ success: true, task_id: taskRes.rows[0].id });
  }
);
