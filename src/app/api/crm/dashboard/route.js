import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmDashboard } from "@/services/crm/dashboard";

export const dynamic = "force-dynamic";

/**
 * GET /api/crm/dashboard — the CRM action dashboard (crm.view).
 *
 * Workspace-wide by decision: the perimeter is shared, never filtered by owner.
 * The composition and the definitions live in `@/services/crm/dashboard`.
 */
export const GET = createHandler(async () => {
  const authError = await requireAuthorization("crm", "view");
  if (authError) return authError;

  const dashboard = await getCrmDashboard();
  return NextResponse.json({ success: true, ...dashboard });
});
