import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

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
    const capError = await requireAuthorization("investor", "view");
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

    let sql = `SELECT p.id, p.name, p.description, p.status, p.industry,
                      p.country, p.start_date, p.end_date, p.created_at,
                      p.completion_index,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = p.id) as investor_interest_count
               FROM v2_programs p
               WHERE p.is_archived = 0 AND p.status = 'active'`;
    const args = [];

    // Text search
    if (search) {
      sql += ` AND (p.name ILIKE ? OR p.description ILIKE ? OR p.industry ILIKE ?)`;
      const q = `%${search}%`;
      args.push(q, q, q);
    }

    // Industry filter
    if (industry) {
      const industries = industry.split(",").filter(Boolean);
      if (industries.length > 0) {
        sql += ` AND (${industries.map(() => "p.industry ILIKE ?").join(" OR ")})`;
        industries.forEach(i => args.push(`%${i.trim()}%`));
      }
    }

    // Country filter
    if (country) {
      const countries = country.split(",").filter(Boolean);
      if (countries.length > 0) {
        sql += ` AND (${countries.map(() => "p.country ILIKE ?").join(" OR ")})`;
        countries.forEach(c => args.push(`%${c.trim()}%`));
      }
    }

    // Stage filter
    if (stage) {
      const stages = stage.split(",").filter(Boolean);
      if (stages.length > 0) {
        sql += ` AND (${stages.map(() => "p.business_stage ILIKE ?").join(" OR ")})`;
        stages.forEach(s => args.push(`%${s.trim()}%`));
      }
    }

    // Funding range
    if (fundingMin) {
      sql += " AND (p.funding_requirement::numeric >= ?)";
      args.push(parseFloat(fundingMin));
    }
    if (fundingMax) {
      sql += " AND (p.funding_requirement::numeric <= ?)";
      args.push(parseFloat(fundingMax));
    }

    // Count total
    const countSql = sql.replace(/SELECT .* FROM/, "SELECT COUNT(*) as total FROM");
    const countRes = await db.execute({ sql: countSql, args });
    const total = parseInt(countRes.rows[0]?.total || 0);

    // Final query
    sql += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    const result = await db.execute({ sql, args });

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
