import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

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
 *   search    — text search (name, founder, industry, description)
 *   industry  — comma-separated industries
 *   country   — comma-separated countries
 *   stage     — business stage (Pre-Seed, Seed, Series A, etc.)
 *   funding_min / funding_max — funding requirement range
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
    const fundingMin = searchParams.get("funding_min") || "";
    const fundingMax = searchParams.get("funding_max") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Count total
    const countRes = await countInvestorVentureSearch({ search, industry, country, stage, fundingMin, fundingMax });
    const total = parseInt(countRes.rows[0]?.total || 0);

    // Final query
    const result = await searchInvestorVentures({ search, industry, country, stage, fundingMin, fundingMax, limit, offset });

    // For each venture, get KPIs if available
    const ventures = result.rows.map(v => ({
      ...v,
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
