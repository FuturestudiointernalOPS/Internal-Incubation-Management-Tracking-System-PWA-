import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { buildAdminOverview } from "@/services/investor";

/**
 * GET /api/investor/admin-overview — super admin DD/pipeline overview
 *
 * The blocks the overview aggregates live in `@/services/investor`.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;

    const overview = await buildAdminOverview();

    return NextResponse.json({ success: true, ...overview });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
