import { withInvestorPrivacy } from "@/server/investor/withPrivacy";
import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import {
  countInvestorVentureSearch,
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
async function GETWithOriginalGuards(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;
    await ensureInvestorExpansionSchema();

    const session = await getSession();
    const ctx = await resolveInvestorContext(session);
    const mode = ctx.visibilityMode === "full_pipeline" ? "full_pipeline" : "deal_flow_only";

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const industry = searchParams.get("industry") || "";
    const country = searchParams.get("country") || "";
    const stage = mode === "full_pipeline" ? searchParams.get("stage") || "" : "";
    const requestedLimit = Number(searchParams.get("limit") || 50);
    const requestedOffset = Number(searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100
      || !Number.isSafeInteger(requestedOffset) || requestedOffset < 0) {
      return NextResponse.json({ success: false, error: "errors.invalidRequest" }, { status: 400 });
    }
    const limit = requestedLimit;
    const offset = requestedOffset;
    const fundingMin = mode === "full_pipeline" && searchParams.get("funding_min") ? Number(searchParams.get("funding_min")) : null;
    const fundingMax = mode === "full_pipeline" && searchParams.get("funding_max") ? Number(searchParams.get("funding_max")) : null;
    if ([fundingMin, fundingMax].some(value => value !== null && (!Number.isFinite(value) || value < 0))
      || (fundingMin !== null && fundingMax !== null && fundingMin > fundingMax)) {
      return NextResponse.json({ success: false, error: "errors.invalidRequest" }, { status: 400 });
    }

    const countResult = await countInvestorVentureSearch({ search, industry, country, stage, visibilityMode: mode, fundingMin, fundingMax });
    const directoryTotal = parseInt(countResult.rows[0]?.total || 0);
    const result = await searchInvestorVentures({
      search,
      industry,
      country,
      stage,
      limit,
      offset,
      visibilityMode: mode,
      fundingMin, fundingMax,
    });

    const ventures = investorVentureList(result.rows, { mode });
    const total = directoryTotal;

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
    }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}

export const GET = withInvestorPrivacy(GETWithOriginalGuards, "ventures");
