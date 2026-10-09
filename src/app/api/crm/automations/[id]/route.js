import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { updateCrmAutomationRule, deleteCrmAutomationRule, getAutomationExecutionsByRule } from "@/models/crm/intelligence";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const { id } = await params;
    const result = await getAutomationExecutionsByRule(id);
    
    return NextResponse.json({ success: true, executions: result.rows || [] });
  }
);

export const PATCH = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();

    const result = await updateCrmAutomationRule(id, body);
    if (!result.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Rule not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, rule: result.rows[0] });
  }
);

export const DELETE = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const { id } = await params;
    await deleteCrmAutomationRule(id);

    return NextResponse.json({ success: true });
  }
);
