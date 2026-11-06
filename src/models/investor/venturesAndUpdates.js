import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";
import { INVESTOR_FOUNDER_FACTS } from "./founderFacts";

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
const LIVE_DEAL = `SELECT 1 FROM deal_flow_entries e
  WHERE (e.venture_id = v.id::text OR e.venture_id = v.venture_id)
    AND e.status = 'live' AND e.target_amount > 0 AND e.currency IS NOT NULL
    AND EXISTS (SELECT 1 FROM deal_flow_decks d
                WHERE d.deal_flow_entry_id = e.id AND d.status = 'published')`;
const liveField = field => `(${LIVE_DEAL.replace("SELECT 1", `SELECT e.${field}`)}
  ORDER BY e.opened_at DESC NULLS LAST, e.id DESC LIMIT 1)`;

const DIRECTORY_SELECT = `SELECT v.id, COALESCE(v.name, v.company_name) AS name,
                      v.description, v.status, v.industry, v.country, v.logo_url,
                      v.business_stage, v.created_at, ${INVESTOR_FOUNDER_FACTS},
                      ${liveField("target_amount")} AS raise_amount, ${liveField("currency")} AS currency,
                      ${liveField("id")} AS deal_flow_id,
                      NULL::numeric AS completion_index,
                      NULL::text AS funding_requirement,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = v.id) AS investor_interest_count
               ${DIRECTORY_FROM}`;

/** The WHERE clauses (and their args) a directory search applies. */
function buildVentureSearchFilters({ search, industry, country, stage, fundingMin, fundingMax, visibilityMode = "full_pipeline" }) {
  const clauses = [
    "COALESCE(v.is_archived::text, '0') NOT IN ('1','t','true')",
    "LOWER(COALESCE(v.status, '')) <> 'archived'",
  ];
  const args = [];
  if (visibilityMode !== "full_pipeline") clauses.push(`EXISTS (${LIVE_DEAL})`);
  if (visibilityMode === "full_pipeline" && (fundingMin != null || fundingMax != null)) {
    let predicate = LIVE_DEAL;
    if (fundingMin != null) { predicate += " AND e.target_amount >= ?"; args.push(fundingMin); }
    if (fundingMax != null) { predicate += " AND e.target_amount <= ?"; args.push(fundingMax); }
    clauses.push(`EXISTS (${predicate})`);
  }

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

  if (stage && visibilityMode === "full_pipeline") {
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
export async function searchInvestorVentures({ search, industry, country, stage, limit, offset, visibilityMode, fundingMin, fundingMax }) {
  const { where, args } = buildVentureSearchFilters({ search, industry, country, stage, visibilityMode, fundingMin, fundingMax });
  const sql = `${DIRECTORY_SELECT} WHERE ${where} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
  return db.execute({ sql, args: [...args, limit, offset] });
}

/** Resolve a visible venture for a verified view/compare interaction. */
export async function findVisibleInvestorVenture(ventureRef, visibilityMode) {
  const { where, args } = buildVentureSearchFilters({ visibilityMode });
  return db.execute({
    sql: `SELECT v.id::text AS id FROM ventures v WHERE ${where}
          AND (v.id::text = ? OR v.venture_id = ?) LIMIT 1`,
    args: [...args, String(ventureRef), String(ventureRef)],
  });
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
export async function createVentureUpdate({ venture_id: ventureRef, title, content, update_type, created_by }) {
  // venture_updates holds the INTERNAL id (Phase 0).
  const venture_id = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "INSERT INTO venture_updates (venture_id, title, content, update_type, created_by) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [venture_id, title, content, update_type || "general", created_by],
  });
}
