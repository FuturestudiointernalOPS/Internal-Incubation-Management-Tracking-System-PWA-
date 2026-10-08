/**
 * Venture portfolio overview — decisions (SERVICE layer).
 *
 * Shapes the four repository counts into the Portfolio overview the Super
 * Admin sees at `/admin/ventures/dashboard`: Ventures by phase, Ventures by
 * sector, the distribution across the four investment-readiness levels, and how
 * many Parcours are running right now.
 *
 * Two decisions this module owns:
 *
 * Every bucket is always present. A phase, a sector lens or a readiness level
 * with no Venture reports 0 rather than disappearing — a distribution that
 * silently drops its empty members cannot be read as a distribution, and the
 * "Prêt à lever des fonds" row with nothing in it is information too.
 *
 * Readiness is counted from the newest assessment per Venture only, so the
 * four levels always sum back to `assessed`, never above the portfolio.
 *
 * Pure read: no writes, no SQL. Statements live in
 * `@/models/venturePortfolioStore`.
 */

import {
  countActiveParcours,
  countTotalVentures,
  countVenturesByPhase,
  countVenturesByReadinessLevel,
  countVenturesBySector,
} from "@/models/venturePortfolioStore";
import { INVESTMENT_LEVELS } from "@/services/ventures/investmentReadiness";

/** The five business phases, in the order the portfolio reports them. */
export const PORTFOLIO_PHASES = ["idea", "validation", "early_traction", "growth", "scaling"];

const toCount = (rows, field) => new Map((rows || []).map((row) => [row[field], row.count ?? 0]));

/** Unknown and missing phases keep their own trailing bucket — never dropped. */
function shapePhases(rawRows) {
  const counts = toCount(rawRows, "phase");
  const ordered = PORTFOLIO_PHASES.map((phase) => ({ key: phase, count: counts.get(phase) ?? 0 }));
  const known = new Set(PORTFOLIO_PHASES);

  for (const [phase, count] of counts) {
    if (!known.has(phase)) ordered.push({ key: phase || null, count });
  }

  return ordered;
}

/** Sectors are reported largest first; a Venture with no industry keeps its own bucket. */
function shapeSectors(rawRows) {
  return (rawRows || []).map((row) => ({ key: row.sector || null, count: row.count ?? 0 }));
}

/**
 * All four levels are reported, in readiness order, whether or not a Venture
 * sits in them — plus any level the engine has since added, so a new band
 * appears rather than being swallowed.
 */
function shapeReadiness(rawRows) {
  const counts = toCount(rawRows, "level");
  const ordered = INVESTMENT_LEVELS.map((band) => ({
    level: band.level,
    min: band.min,
    max: band.max,
    count: counts.get(band.level) ?? 0,
  }));
  const known = new Set(INVESTMENT_LEVELS.map((band) => band.level));

  for (const [level, count] of counts) {
    if (!known.has(level)) ordered.push({ level, min: null, max: null, count });
  }

  return ordered;
}

/**
 * @returns the whole Portfolio overview in one shape, safe to render as-is.
 */
export async function buildVenturePortfolio() {
  const [totalResult, phaseResult, sectorResult, readinessResult, parcoursResult] = await Promise.all([
    countTotalVentures(),
    countVenturesByPhase(),
    countVenturesBySector(),
    countVenturesByReadinessLevel(),
    countActiveParcours(),
  ]);

  const byPhase = shapePhases(phaseResult.rows);
  const byReadiness = shapeReadiness(readinessResult.rows);
  const assessed = byReadiness.reduce((sum, band) => sum + band.count, 0);

  return {
    total: totalResult.rows[0]?.count ?? 0,
    byPhase,
    bySector: shapeSectors(sectorResult.rows),
    byReadiness,
    assessed,
    activeParcours: parcoursResult.rows[0]?.count ?? 0,
    calculated_at: new Date().toISOString(),
  };
}
