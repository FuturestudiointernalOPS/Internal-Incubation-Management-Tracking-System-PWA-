import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireAuthorization } from "@/models/authorization/index";
import { setInvestorVisibilityMode } from "@/services/investor/visibility";

/**
 * PUT /api/investor/visibility  { investor_id, mode, old_mode? }
 *
 * Studio-only: the investor can never change its own mode. Logged as
 * `visibility_mode_changed` with the old/new pair.
 */
export async function PUT(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const { investor_id, mode, old_mode } = await req.json();
    if (!investor_id || !mode) {
      return NextResponse.json(
        { success: false, error: "investor_id and mode required" },
        { status: 400 },
      );
    }

    const result = await setInvestorVisibilityMode({
      investorId: investor_id,
      mode,
      oldMode: old_mode ?? null,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, investor: result.investor });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
