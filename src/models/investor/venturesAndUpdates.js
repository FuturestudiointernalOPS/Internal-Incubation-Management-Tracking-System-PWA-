import db from "@/lib/db";

// ── GET /api/investor/ventures ──────────────────────────────────────────────

/**
 * ventures GET — build the filtered venture-search SQL. Shared by the count
 * and the page query below; each executed query gets its own function with a
 * 1:1 copy of the original controller assembly.
 */
function buildVentureSearchQuery({ search, industry, country, stage, fundingMin, fundingMax }) {
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
    const searchPattern = `%${search}%`;
    args.push(searchPattern, searchPattern, searchPattern);
  }

  // Industry filter
  if (industry) {
    const industries = industry.split(",").filter(Boolean);
    if (industries.length > 0) {
      sql += ` AND (${industries.map(() => "p.industry ILIKE ?").join(" OR ")})`;
      industries.forEach(industryName => args.push(`%${industryName.trim()}%`));
    }
  }

  // Country filter
  if (country) {
    const countries = country.split(",").filter(Boolean);
    if (countries.length > 0) {
      sql += ` AND (${countries.map(() => "p.country ILIKE ?").join(" OR ")})`;
      countries.forEach(countryName => args.push(`%${countryName.trim()}%`));
    }
  }

  // Stage filter
  if (stage) {
    const stages = stage.split(",").filter(Boolean);
    if (stages.length > 0) {
      sql += ` AND (${stages.map(() => "p.business_stage ILIKE ?").join(" OR ")})`;
      stages.forEach(stageName => args.push(`%${stageName.trim()}%`));
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

  return { sql, args };
}

/** ventures GET — total count of ventures matching the filters. */
export async function countInvestorVentureSearch(filters) {
  const { sql, args } = buildVentureSearchQuery(filters);
  const countSql = sql.replace(/SELECT .* FROM/, "SELECT COUNT(*) as total FROM");
  return db.execute({ sql: countSql, args });
}

/** ventures GET — filtered venture page (with pagination). */
export async function searchInvestorVentures({ search, industry, country, stage, fundingMin, fundingMax, limit, offset }) {
  const built = buildVentureSearchQuery({ search, industry, country, stage, fundingMin, fundingMax });
  const sql = built.sql + " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
  const args = [...built.args, limit, offset];
  return db.execute({ sql, args });
}

// ── GET/POST /api/investor/updates ──────────────────────────────────────────

/** updates GET — venture updates, newest first. */
export async function listVentureUpdatesByVentureId(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_updates WHERE venture_id = ? ORDER BY created_at DESC",
    args: [ventureId],
  });
}

/** updates POST — create a venture update. */
export async function createVentureUpdate({ venture_id, title, content, update_type, created_by }) {
  return db.execute({
    sql: "INSERT INTO venture_updates (venture_id, title, content, update_type, created_by) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [venture_id, title, content, update_type || "general", created_by],
  });
}

