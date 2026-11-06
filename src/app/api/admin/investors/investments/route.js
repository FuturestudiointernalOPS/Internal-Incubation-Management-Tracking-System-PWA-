import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorStudioAuthorization as requireAuthorization } from "@/server/investor/studioAuthorization";
import {
  confirmInvestment,
  listStudioInvestmentClaims,
  rejectInvestment,
} from "@/services/investor/investment";

/** GET /api/admin/investors/investments?status=pending|confirmed|rejected|all */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;
    await ensureInvestorExpansionSchema();

    const status = new URL(req.url).searchParams.get("status") || "pending";
    const result = await listStudioInvestmentClaims({ status });
    return NextResponse.json({ success: true, claims: result.claims });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT — studio decision on a pending claim.
 * { id, action: "confirm" | "reject", amount?, currency?, instrument?, invested_on?, reason? }
 */
export async function PUT(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const body = await req.json();
    const { id, action } = body || {};
    if (!id || !["confirm", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "id and action (confirm|reject) required" },
        { status: 400 },
      );
    }

    const session = await getSession();

    if (action === "confirm") {
      const result = await confirmInvestment({
        id,
        amount: body.amount ?? null,
        currency: body.currency ?? null,
        instrument: body.instrument ?? null,
        investedOn: body.invested_on ?? null,
        session,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, investment: result.investment });
    }

    const result = await rejectInvestment({
      id,
      reason: body.reason,
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, investment: result.investment });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
