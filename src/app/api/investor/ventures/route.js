import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

import {
  countInvestorVentureSearch,
  searchInvestorVentures,
} from "@/models/investor";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

/**
 * GET /api/investor/ventures
 * Advanced venture search with filters for investors.
 *
 * Query params:
 *   search    — text search (name, description, industry)
 *   industry  — comma-separated industries
 *   country   — comma-separated countries
 *   stage     — business stage (Pre-Seed, Seed, Series A, etc.)
 *
 * The list IS the platform's Venture directory (see
 * `@/models/investor/venturesAndUpdates`), not the incubation programmes it
 * used to read.
 */

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const industry = searchParams.get("industry") || "";
    const country = searchParams.get("country") || "";
    const stage = searchParams.get("stage") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Count total
    const countResult = await countInvestorVentureSearch({ search, industry, country, stage });
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Final query
    const result = await searchInvestorVentures({ search, industry, country, stage, limit, offset });

    // For each venture, get KPIs if available
    const ventures = result.rows.map(venture => ({
      ...venture,
      kpis: null, // Will be populated if KPI data exists
    }));

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
