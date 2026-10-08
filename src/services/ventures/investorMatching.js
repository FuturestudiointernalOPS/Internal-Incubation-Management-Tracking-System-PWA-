/**
 * VENTURE INVESTOR MATCHING.
 *
 * The investor catalogue (list / read / create), the match score (industry,
 * stage, readiness, traction, team), the stored matches and the match-status
 * updates with their history.
 *
 * The decisions — the score weights and reasons, the strengths/weaknesses, and
 * the status side-effects — live here; every statement is in
 * `@/models/ventureInvestorMatchingStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  selectInvestors,
  selectInvestorById,
  selectInvestorPreferences,
  insertInvestor,
  selectMatchingVenture,
  selectLatestReadinessScore,
  selectMatchingTaskTotals,
  countMatchingAcceptedFounders,
  upsertInvestorMatch,
  selectVentureMatches,
  updateMatchScoped,
  selectMatchScoped,
  insertMatchHistory,
} from "@/models/ventureInvestorMatchingStore";

export async function listInvestors({ status, search, limit = 50 } = {}) {
  const result = await selectInvestors({ status, search, limit });
  return (result.rows || []).map((investor) => ({...investor, industries: typeof investor.industries==="string"?JSON.parse(investor.industries):(investor.industries||[]), preferred_countries: typeof investor.preferred_countries==="string"?JSON.parse(investor.preferred_countries):(investor.preferred_countries||[]), portfolio: typeof investor.portfolio==="string"?JSON.parse(investor.portfolio):(investor.portfolio||[])}));
}

export async function getInvestor(investorId) {
  const result = await selectInvestorById(investorId);
  if (result.rows.length === 0) return null;
  const investor = result.rows[0];
  investor.industries = typeof investor.industries==="string"?JSON.parse(investor.industries):(investor.industries||[]);
  investor.preferred_countries = typeof investor.preferred_countries==="string"?JSON.parse(investor.preferred_countries):(investor.preferred_countries||[]);
  investor.portfolio = typeof investor.portfolio==="string"?JSON.parse(investor.portfolio):(investor.portfolio||[]);
  const preferencesResult = await selectInvestorPreferences(investorId);
  investor.preferences = preferencesResult.rows[0] || null;
  return investor;
}

export async function createInvestor({ name, email, organization, investmentThesis, industries, preferredCountries, preferredStage, minTicket, maxTicket, portfolio, websiteUrl, linkedinUrl, createdBy }) {
  const id = (await insertInvestor({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    organization: organization||null,
    investmentThesis: investmentThesis||null,
    industriesJson: JSON.stringify(industries||[]),
    preferredCountriesJson: JSON.stringify(preferredCountries||[]),
    preferredStage: preferredStage||null,
    minTicket: minTicket||null,
    maxTicket: maxTicket||null,
    portfolioJson: JSON.stringify(portfolio||[]),
    websiteUrl: websiteUrl||null,
    linkedinUrl: linkedinUrl||null,
    createdBy: createdBy||"system",
  })).rows[0]?.id;
  return { id };
}

export async function calculateMatchScore(ventureId, investor) {
  const venture = (await selectMatchingVenture(ventureId)).rows[0];
  if (!venture) return { score: 0, reasons: [], strengths: [], weaknesses: [] };

  const reasons = []; const strengths = []; const weaknesses = [];
  let score = 0;
  let readinessScore = 0;
  try { const assessmentResult = await selectLatestReadinessScore(ventureId); readinessScore = assessmentResult.rows[0]?.overall_score||0; } catch {}

  const investorIndustries = typeof investor.industries==="string"?JSON.parse(investor.industries):(investor.industries||[]);

  // Industry (30pts)
  if (investorIndustries.length > 0) {
    const match = investorIndustries.some((industry) => (venture.industry||"").toLowerCase().includes(industry.toLowerCase()) || industry.toLowerCase().includes((venture.industry||"").toLowerCase()));
    if (match) { score += 30; reasons.push("Industry alignment"); strengths.push("Industry matches investor focus"); }
    else weaknesses.push("Industry may not align");
  } else score += 15;

  // Stage (20pts)
  if (investor.preferred_stage) {
    if (investor.preferred_stage === venture.business_stage) { score += 20; reasons.push("Stage alignment"); strengths.push("Business stage matches"); }
    else weaknesses.push(`Investor prefers ${investor.preferred_stage}`);
  } else score += 10;

  // Readiness (20pts)
  const pref = investor.preferences || {};
  const minR = pref.min_readiness_score || 0;
  if (readinessScore >= minR) {
    score += Math.min(20, Math.round(readinessScore/5));
    if (readinessScore >= 50) reasons.push("Investment readiness");
  } else weaknesses.push(`Readiness (${readinessScore}) below minimum (${minR})`);

  // Traction (15pts)
  const taskCounts = (await selectMatchingTaskTotals(ventureId)).rows[0]||{t:0,d:0};
  const tractionRate = parseInt(taskCounts.t)>0?Math.round((parseInt(taskCounts.d)/parseInt(taskCounts.t))*100):0;
  if (tractionRate >= (pref.min_traction_score||0)) { score += Math.min(15, Math.round(tractionRate/7)); if (tractionRate>50) reasons.push("Proven traction"); }
  else weaknesses.push(`Traction below minimum`);

  // Team (15pts)
  const founderCount = (await countMatchingAcceptedFounders(ventureId)).rows[0]?.c||0;
  if (founderCount >= (pref.min_team_size||1)) { score += Math.min(15, founderCount*5); reasons.push("Qualified team"); strengths.push(`${founderCount} founder(s)`); }
  else weaknesses.push(`Team size below minimum`);

  return { score: Math.min(100, score), reasons, strengths, weaknesses };
}

export async function generateMatches(ventureId) {
  const investors = await listInvestors({ status: "active" });
  for (const investor of investors) {
    const match = await calculateMatchScore(ventureId, investor);
    if (match.score > 0) {
      await upsertInvestorMatch(
        ventureId, investor.id, match.score,
        JSON.stringify(match.reasons), JSON.stringify(match.strengths), JSON.stringify(match.weaknesses),
      );
    }
  }
  return { success: true };
}

export async function getVentureMatches(ventureId, minScore = 0) {
  const result = await selectVentureMatches(ventureId, minScore);
  return (result.rows||[]).map((match) => ({...match,
    industries: typeof match.industries==="string"?JSON.parse(match.industries):(match.industries||[]),
    match_reasons: typeof match.match_reasons==="string"?JSON.parse(match.match_reasons):(match.match_reasons||[]),
    strengths: typeof match.strengths==="string"?JSON.parse(match.strengths):(match.strengths||[]),
    weaknesses: typeof match.weaknesses==="string"?JSON.parse(match.weaknesses):(match.weaknesses||[]),
  }));
}

export async function updateMatchStatus(matchId, status, ventureIds = []) {
  const ids = (Array.isArray(ventureIds) ? ventureIds : [ventureIds]).filter(
    (ventureId) => ventureId !== null && ventureId !== undefined,
  );
  if (ids.length === 0) return { success: false };
  const scope = ids.map(() => "venture_id = ?").join(" OR ");
  const sets = ["status = ?"]; const args = [status];
  if (status === "contacted") sets.push("contacted_at = NOW()");
  if (status === "viewed") sets.push("viewed_by_founder = TRUE");
  args.push(matchId, ...ids);
  // The update AND the history read are scoped to this venture, so a match id
  // from another venture changes nothing and writes no history row.
  await updateMatchScoped(sets, args, scope);
  const matchResult = await selectMatchScoped(matchId, scope, ids);
  if (matchResult.rows.length > 0) await insertMatchHistory(matchId, matchResult.rows[0].venture_id, matchResult.rows[0].investor_id, `MATCH_${status.toUpperCase()}`);
  return { success: true };
}
