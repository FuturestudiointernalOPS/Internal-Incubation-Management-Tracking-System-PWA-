/**
 * Venture portfolio overview — statements (REPOSITORY layer).
 *
 * The multi-venture aggregates behind the Super Admin's Portfolio overview
 * (`GET /api/admin/ventures/dashboard`). Every query counts across the WHOLE
 * portfolio in SQL — nothing reads a Venture at a time — and nothing here
 * decides how the numbers are presented. That shaping belongs to
 * `@/services/ventures/portfolio`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement,
 * no decisions.
 */

import db from "@/lib/db";

/** How many Ventures exist in total — the denominator of the overview. */
export function countTotalVentures() {
  return db.execute({ sql: "SELECT COUNT(*)::int AS count FROM ventures" });
}

/** Ventures per business phase (idea → validation → early traction → growth → scaling). */
export function countVenturesByPhase() {
  return db.execute({
    sql: `SELECT COALESCE(business_stage, '') AS phase, COUNT(*)::int AS count
          FROM ventures
          GROUP BY business_stage
          ORDER BY business_stage`,
  });
}

/** Ventures per industry — the sector lens of the overview. */
export function countVenturesBySector() {
  return db.execute({
    sql: `SELECT COALESCE(industry, '') AS sector, COUNT(*)::int AS count
          FROM ventures
          GROUP BY industry
          ORDER BY count DESC, industry ASC`,
  });
}

/**
 * Ventures per investment-readiness level, counting each Venture exactly ONCE.
 *
 * `investment_assessments` keeps the full history, so a Venture scored five
 * times would otherwise appear five times and the distribution would exceed the
 * portfolio. The window function keeps only the newest row per Venture before
 * grouping, which is what makes the four levels sum back to the real total.
 */
export function countVenturesByReadinessLevel() {
  return db.execute({
    sql: `SELECT latest.investment_level AS level, COUNT(*)::int AS count
          FROM (
            SELECT venture_id, investment_level,
                   ROW_NUMBER() OVER (
                     PARTITION BY venture_id ORDER BY calculated_at DESC
                   ) AS rn
            FROM investment_assessments
          ) latest
          WHERE latest.rn = 1
          GROUP BY latest.investment_level`,
  });
}

/**
 * Journey stages (Parcours) running right now across the portfolio.
 *
 * A stage is counted while it is `active`; `upcoming`, `completed` and `locked`
 * stages are not running, and an archived stage is out of the portfolio
 * entirely. Several stages can be active at once — the count is of stages, not
 * of Ventures.
 */
export function countActiveParcours() {
  return db.execute({
    sql: `SELECT COUNT(*)::int AS count
          FROM venture_journey_stages
          WHERE status = 'active'
            AND (is_archived = FALSE OR is_archived IS NULL)`,
  });
}
