/**
 * Venture investor matching — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/investorMatching`: the investor
 * catalogue and preferences, the Venture probes the score reads, the stored
 * matches and their status writes.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Investor catalogue ───────────────────────────────────────────────────────

/** Investors (optional status/search filters), by name. */
export function selectInvestors({ status, search, limit } = {}) {
  let sql = "SELECT * FROM venture_investors WHERE 1=1";
  const args = [];
  if (status) { sql += " AND status = ?"; args.push(status); }
  if (search) { sql += " AND (name ILIKE ? OR organization ILIKE ?)"; args.push(`%${search}%`, `%${search}%`); }
  sql += " ORDER BY name ASC LIMIT ?"; args.push(limit);
  return db.execute({ sql, args });
}

/** One investor row. */
export function selectInvestorById(investorId) {
  return db.execute({ sql: "SELECT * FROM venture_investors WHERE id=?", args: [investorId] });
}

/** An investor's preferences row. */
export function selectInvestorPreferences(investorId) {
  return db.execute({ sql: "SELECT * FROM venture_investor_preferences WHERE investor_id=?", args: [investorId] });
}

/** Insert one investor, returning its id. */
export function insertInvestor({
  name, email, organization, investmentThesis, industriesJson, preferredCountriesJson,
  preferredStage, minTicket, maxTicket, portfolioJson, websiteUrl, linkedinUrl, createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO venture_investors (name, email, organization, investment_thesis, industries, preferred_countries, preferred_stage, min_ticket, max_ticket, portfolio, website_url, linkedin_url, created_by) VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?::jsonb, ?, ?, ?) RETURNING id`,
    args: [name, email, organization, investmentThesis, industriesJson, preferredCountriesJson, preferredStage, minTicket, maxTicket, portfolioJson, websiteUrl, linkedinUrl, createdBy],
  });
}

// ── Scoring probes ───────────────────────────────────────────────────────────

/** A Venture's industry + business stage (match scoring). */
export function selectMatchingVenture(ventureId) {
  return db.execute({ sql: "SELECT industry, business_stage FROM ventures WHERE venture_id=?", args: [ventureId] });
}

/** A Venture's latest readiness score. */
export function selectLatestReadinessScore(ventureId) {
  return db.execute({ sql: "SELECT overall_score FROM investment_assessments WHERE venture_id=? ORDER BY calculated_at DESC LIMIT 1", args: [ventureId] });
}

/** Task totals (total / done) for match scoring. */
export function selectMatchingTaskTotals(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as d FROM venture_tasks WHERE venture_id=?", args: [ventureId] });
}

/** Count a Venture's accepted founders (match scoring). */
export function countMatchingAcceptedFounders(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_founders WHERE venture_id=? AND status='accepted'", args: [ventureId] });
}

// ── Matches ──────────────────────────────────────────────────────────────────

/** Upsert one investor match. */
export function upsertInvestorMatch(ventureId, investorId, matchScore, reasonsJson, strengthsJson, weaknessesJson) {
  return db.execute({
    sql: `INSERT INTO venture_investor_matches (venture_id, investor_id, match_score, match_reasons, strengths, weaknesses)
          VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)
          ON CONFLICT (venture_id, investor_id) DO UPDATE SET match_score=EXCLUDED.match_score, updated_at=NOW()`,
    args: [ventureId, investorId, matchScore, reasonsJson, strengthsJson, weaknessesJson],
  });
}

/** A Venture's matches at or above a score, best first. */
export function selectVentureMatches(ventureId, minScore) {
  return db.execute({
    sql: `SELECT vim.*, vi.name as investor_name, vi.organization, vi.photo_url, vi.investment_thesis,
       vi.industries, vi.preferred_stage, vi.min_ticket, vi.max_ticket, vi.website_url, vi.linkedin_url
       FROM venture_investor_matches vim JOIN venture_investors vi ON vim.investor_id = vi.id
       WHERE vim.venture_id=? AND vim.match_score>=? ORDER BY vim.match_score DESC`,
    args: [ventureId, minScore],
  });
}

/** Update one match (with a caller-built SET list), scoped by venture. */
export function updateMatchScoped(sets, args, scopeSql) {
  return db.execute({ sql: `UPDATE venture_investor_matches SET ${sets.join(", ")}, updated_at=NOW() WHERE id=? AND (${scopeSql})`, args });
}

/** Read one match's ids, scoped by venture. */
export function selectMatchScoped(matchId, scopeSql, ids) {
  return db.execute({ sql: `SELECT venture_id, investor_id FROM venture_investor_matches WHERE id=? AND (${scopeSql})`, args: [matchId, ...ids] });
}

/** Append a match-history row. */
export function insertMatchHistory(matchId, ventureId, investorId, action) {
  return db.execute({ sql: `INSERT INTO venture_match_history (match_id, venture_id, investor_id, action) VALUES (?, ?, ?, ?)`, args: [matchId, ventureId, investorId, action] });
}
