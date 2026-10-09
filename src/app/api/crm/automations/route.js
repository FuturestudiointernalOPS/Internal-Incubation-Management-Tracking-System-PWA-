import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmAutomationRules, createCrmAutomationRule } from "@/models/crm/intelligence";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async () => {
    // Requires manage permission because automations are powerful
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const result = await getCrmAutomationRules();
    return NextResponse.json({ success: true, rules: result.rows || [] });
  }
);

export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const body = await req.json();
    const session = await getSession();

    if (!body.name || !body.entity_type || !body.trigger_event) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    const result = await createCrmAutomationRule({
      name: body.name,
      description: body.description,
      entityType: body.entity_type,
      triggerEvent: body.trigger_event,
      conditions: body.conditions || [],
      actions: body.actions || [],
      active: body.active !== false,
      createdBy: session?.user?.cid
    });

    return NextResponse.json({ success: true, rule: result.rows?.[0] });
  }
);
