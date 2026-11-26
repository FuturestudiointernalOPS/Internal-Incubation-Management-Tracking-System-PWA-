import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import {
  countInvestorVentureSearch,
  listActiveDealFlowEntriesWithVenture,
  searchInvestorVentures,
} from "@/models/investor";
import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { emitInvestorEvent, resolveInvestorContext } from "@/services/investor/activity";
import { investorVentureList } from "@/services/investor/dto";

/**
 * GET /api/investor/ventures
 * Advanced venture search with filters for investors.
 *
 * Phase 1–3: the response is DTO-shaped and honours the caller's visibility
 * mode. In `deal_flow_only` the directory result is intersected with live deal
 * flow, so no non-deal-flow venture leaks through the search endpoint.
 */
export async function GET(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const session = await getSession();
    const ctx = await resolveInvestorContext(session);
    const mode = ctx.visibilityMode || "deal_flow_only";

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const industry = searchParams.get("industry") || "";
    const country = searchParams.get("country") || "";
    const stage = searchParams.get("stage") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const countResult = await countInvestorVentureSearch({ search, industry, country, stage });
    const directoryTotal = parseInt(countResult.rows[0]?.total || 0);
    const result = await searchInvestorVentures({
      search,
      industry,
      country,
      stage,
      limit,
      offset,
    });

    let rows = result.rows;

    if (mode === "deal_flow_only") {
      const live = await listActiveDealFlowEntriesWithVenture();
      const allowed = new Set((live.rows || []).map((row) => String(row.venture_id)));
      rows = rows.filter((row) => allowed.has(String(row.id)));
    }

    const ventures = investorVentureList(rows, { mode });
    const total = mode === "deal_flow_only" ? rows.length : directoryTotal;

    await emitInvestorEvent({
      session,
      eventType: "search_used",
      metadata: { search, industry, country, stage, mode },
    });

    return NextResponse.json({
      success: true,
      ventures,
      total,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
