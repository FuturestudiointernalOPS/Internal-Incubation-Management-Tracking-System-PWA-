import db from "@/lib/db";

// ── GET /api/investor/ventures ──────────────────────────────────────────────

/**
 * ventures GET — the investor DIRECTORY reads the platform's own Ventures.
 *
 * The investor portal used to read the incubation programmes under a venture
 * shape; the directory investors explore is the "ventures" table, so that is
 * what these queries select. `name`/`company_name` are two generations of the
 * same label and are coalesced; readiness and funding have no column on a
 * Venture yet, so they come back as NULL rather than as a borrowed number.
 *
 * A Venture is listed unless it is archived (either way it was archived: the
 * status, or the flag). `is_archived` may be an integer or a boolean depending
 * on which generation created the table, so it is compared as text.
 *
 * The funding-range filter is deliberately NOT applied: a Venture carries no
 * funding amount yet, so a range would silently match nothing. It is dropped
 * rather than faked.
 */
const DIRECTORY_FROM = `FROM ventures v`;

const DIRECTORY_SELECT = `SELECT v.id, COALESCE(v.name, v.company_name) AS name,
                      v.description, v.status, v.industry, v.country,
                      v.business_stage, v.created_at,
                      NULL::numeric AS completion_index,
                      NULL::text AS funding_requirement,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = v.id) AS investor_interest_count
               ${DIRECTORY_FROM}`;

/** The WHERE clauses (and their args) a directory search applies. */
function buildVentureSearchFilters({ search, industry, country, stage }) {
  const clauses = [
    "COALESCE(v.is_archived::text, '0') NOT IN ('1','t','true')",
    "LOWER(COALESCE(v.status, '')) <> 'archived'",
  ];
  const args = [];

  if (search) {
    clauses.push("(COALESCE(v.name, v.company_name) ILIKE ? OR v.description ILIKE ? OR v.industry ILIKE ?)");
    const searchPattern = `%${search}%`;
    args.push(searchPattern, searchPattern, searchPattern);
  }

  if (industry) {
    const industries = industry.split(",").filter(Boolean);
    if (industries.length > 0) {
      clauses.push(`(${industries.map(() => "v.industry ILIKE ?").join(" OR ")})`);
      industries.forEach((industryName) => args.push(`%${industryName.trim()}%`));
    }
  }

  if (country) {
    const countries = country.split(",").filter(Boolean);
    if (countries.length > 0) {
      clauses.push(`(${countries.map(() => "v.country ILIKE ?").join(" OR ")})`);
      countries.forEach((countryName) => args.push(`%${countryName.trim()}%`));
    }
  }

  if (stage) {
    const stages = stage.split(",").filter(Boolean);
    if (stages.length > 0) {
      clauses.push(`(${stages.map(() => "v.business_stage ILIKE ?").join(" OR ")})`);
      stages.forEach((stageName) => args.push(`%${stageName.trim()}%`));
    }
  }

  return { where: clauses.join(" AND "), args };
}

/** ventures GET — total count of Ventures matching the filters. */
export async function countInvestorVentureSearch(filters) {
  const { where, args } = buildVentureSearchFilters(filters);
  return db.execute({ sql: `SELECT COUNT(*) AS total ${DIRECTORY_FROM} WHERE ${where}`, args });
}

/** ventures GET — filtered Venture page (with pagination). */
export async function searchInvestorVentures({ search, industry, country, stage, limit, offset }) {
  const { where, args } = buildVentureSearchFilters({ search, industry, country, stage });
  const sql = `${DIRECTORY_SELECT} WHERE ${where} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
  return db.execute({ sql, args: [...args, limit, offset] });
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

