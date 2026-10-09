import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmActivityById,
  updateCrmActivity,
  deleteCrmActivity,
} from "@/models/crm/activities";

export const dynamic = "force-dynamic";

export const PATCH = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();

    // System-generated event types are not editable
    if (body.type) {
      return NextResponse.json(
        { success: false, error: "Activity type cannot be changed after creation." },
        { status: 400 }
      );
    }

    const result = await updateCrmActivity(id, body);
    const activity = result.rows[0] ?? null;

    if (!activity) {
      return NextResponse.json({ success: false, error: "crm.activities.notFound" }, { status: 404 });
    }

    return NextResponse.json({ success: true, activity });
  }
);

export const DELETE = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    const { id } = await params;

    // Only the manual activities stored here may be deleted. System events
    // (stage changes etc.) live in crm_opportunity_stage_history and
    // contact_timeline — not in crm_activities.
    const check = await getCrmActivityById(id);
    if (!check.rows[0]) {
      return NextResponse.json({ success: false, error: "crm.activities.notFound" }, { status: 404 });
    }

    await deleteCrmActivity(id);

    return NextResponse.json({ success: true });
  }
);
