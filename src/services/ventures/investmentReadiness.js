/**
 * VENTURE INVESTMENT READINESS ASSESSMENT.
 *
 * The 10-category readiness score (computed from the Venture's existing data
 * with fixed weights), the stored assessment / scores / history, and the
 * recommendations generated for the weak categories.
 *
 * The decisions — the per-category scoring rules, the level thresholds, the
 * weights and the recommendation templates/priority — live here; every statement
 * is in `@/models/ventureInvestmentReadinessStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) — see
 * docs/LAYER_SPLIT.md.
 */

import {
  selectReadinessStartupProfile,
  selectReadinessVerificationStatus,
  selectReadinessRegistrationNumber,
  countVerifiedFinancialDocuments,
  countApprovedFinancialDeliverables,
  countApprovedDeliverables,
  countApprovedPrototypes,
  selectReadinessMilestoneTotals,
  selectReadinessTaskTotals,
  countDoneTasks,
  selectReadinessIndustryAndStage,
  selectReadinessBusinessStage,
  countReadinessCompletedSessions,
  countReadinessPitchReviews,
  countReadinessAcceptedFounders,
  countReadinessCoachAssignments,
  countVentureVerificationDocuments,
  selectLatestAssessmentSummary,
  selectLatestAssessment,
  insertAssessment,
  insertAssessmentScore,
  selectAssessmentScores,
  insertInvestmentHistory,
  selectInvestmentHistory,
  deleteOpenRecommendations,
  selectResourceIdByTag,
  insertRecommendation,
  selectOpenRecommendations,
  selectInvestmentRecommendations,
} from "@/models/ventureInvestmentReadinessStore";

export const INVESTMENT_CATEGORIES = [
  "startup_profile", "legal", "financial", "product", "traction",
  "market_validation", "business_model", "team", "technology", "pitch_readiness",
];

export const INVESTMENT_LEVELS = [
  { min: 0, max: 25, level: "not_ready", label: "Not Ready", color: "text-rose-400 bg-rose-500/10" },
  { min: 26, max: 50, level: "early_ready", label: "Early Ready", color: "text-amber-400 bg-amber-500/10" },
  { min: 51, max: 75, level: "investment_ready", label: "Investment Ready", color: "text-emerald-400 bg-emerald-500/10" },
  { min: 76, max: 100, level: "fundraising_ready", label: "Fundraising Ready", color: "text-[var(--brand-orange)] bg-brand-orange/10" },
];

function getInvestmentLevel(score) {
  for (const investmentLevel of INVESTMENT_LEVELS) {
    if (score >= investmentLevel.min && score <= investmentLevel.max) return { level: investmentLevel.level, label: investmentLevel.label, color: investmentLevel.color };
  }
  return { level: "not_ready", label: "Not Ready", color: "text-rose-400 bg-rose-500/10" };
}

/**
 * Calculate investment readiness score for a venture.
 * Evaluates 10 categories using existing data.
 */
export async function calculateInvestmentReadiness(ventureId) {
  const scores = {};

  // 1. Startup Profile (exists + submitted + completion %)
  let profileScore = 0;
  try {
    const pRes = await selectReadinessStartupProfile(ventureId);
    if (pRes.rows.length > 0) {
      const profile = pRes.rows[0];
      let filled = 0; const total = 5;
      for (let stepIndex = 1; stepIndex <= total; stepIndex++) {
        const key = `step_${stepIndex}_data`;
        const data = typeof profile[key] === "string" ? JSON.parse(profile[key]) : (profile[key] || {});
        if (Object.keys(data).length > 0) filled++;
      }
      profileScore = Math.round((filled / total) * 100);
      if (profile.is_submitted) profileScore = Math.min(100, profileScore + 20);
    }
  } catch { profileScore = 0; }
  scores.startup_profile = Math.min(100, profileScore);

  // 2. Legal (verification + registration_number)
  let legalScore = 0;
  try {
    const vRes = await selectReadinessVerificationStatus(ventureId);
    const vStatus = vRes.rows[0]?.status;
    if (vStatus === "verified") legalScore = 100;
    else if (vStatus === "pending_review") legalScore = 50;
    else legalScore = 10;
    const vent = await selectReadinessRegistrationNumber(ventureId);
    if (vent.rows[0]?.registration_number) legalScore = Math.min(100, legalScore + 20);
  } catch { legalScore = 0; }
  scores.legal = legalScore;

  // 3. Financial (financial_docs verification + deliverables)
  let financialScore = 0;
  try {
    const verif = await countVerifiedFinancialDocuments(ventureId);
    if (parseInt(verif.rows[0]?.c||0) > 0) financialScore = 60;
    const dels = await countApprovedFinancialDeliverables(ventureId);
    if (parseInt(dels.rows[0]?.c||0) > 0) financialScore = Math.min(100, financialScore + 20);
  } catch { financialScore = 0; }
  scores.financial = financialScore;

  // 4. Product (milestones completed + deliverables approved)
  let productScore = 0;
  try {
    const ms = await selectReadinessMilestoneTotals(ventureId);
    const milestoneCounts = ms.rows[0] || { t: 0, d: 0 };
    productScore = parseInt(milestoneCounts.t) > 0 ? Math.round((parseInt(milestoneCounts.d)/parseInt(milestoneCounts.t))*100) : 0;
    const dels = await countApprovedDeliverables(ventureId);
    if (parseInt(dels.rows[0]?.c||0) > 3) productScore = Math.min(100, productScore + 20);
  } catch { productScore = 0; }
  scores.product = productScore;

  // 5. Traction (tasks done + KPI progress)
  let tractionScore = 0;
  try {
    const ts = await selectReadinessTaskTotals(ventureId);
    const taskCounts = ts.rows[0] || { t: 0, d: 0 };
    tractionScore = parseInt(taskCounts.t) > 0 ? Math.round((parseInt(taskCounts.d)/parseInt(taskCounts.t))*100) : 0;
  } catch { tractionScore = 0; }
  scores.traction = tractionScore;

  // 6. Market Validation (industry + business_stage + sessions)
  let marketScore = 0;
  try {
    const vent = await selectReadinessIndustryAndStage(ventureId);
    if (vent.rows[0]?.industry) marketScore = 30;
    if (vent.rows[0]?.business_stage) marketScore += 20;
    const sessionResult = await countReadinessCompletedSessions(ventureId);
    if (parseInt(sessionResult.rows[0]?.c||0) > 0) marketScore = Math.min(100, marketScore + 20);
  } catch { marketScore = 0; }
  scores.market_validation = marketScore;

  // 7. Business Model (profile completion + stage progression)
  let businessModelScore = 0;
  try {
    const vent = await selectReadinessBusinessStage(ventureId);
    const stage = vent.rows[0]?.business_stage || "idea";
    const stageMap = { idea: 10, validation: 30, early_traction: 50, growth: 70, scaling: 90 };
    businessModelScore = stageMap[stage] || 10;
  } catch { businessModelScore = 0; }
  scores.business_model = businessModelScore;

  // 8. Team (founders + coaches assigned)
  let teamScore = 0;
  try {
    const founderResult = await countReadinessAcceptedFounders(ventureId);
    const founders = parseInt(founderResult.rows[0]?.c||0);
    teamScore = Math.min(50, founders * 25);
    const coachResult = await countReadinessCoachAssignments(ventureId);
    if (parseInt(coachResult.rows[0]?.c||0) > 0) teamScore = Math.min(100, teamScore + 30);
  } catch { teamScore = 0; }
  scores.team = teamScore;

  // 9. Technology (tasks + deliverables related to tech)
  let techScore = 0;
  try {
    const dels = await countApprovedPrototypes(ventureId);
    if (parseInt(dels.rows[0]?.c||0) > 0) techScore = 60;
    const ts = await countDoneTasks(ventureId);
    if (parseInt(ts.rows[0]?.c||0) > 5) techScore = Math.min(100, techScore + 20);
  } catch { techScore = 0; }
  scores.technology = techScore;

  // 10. Pitch Readiness (pitch review sessions + documents)
  let pitchScore = 0;
  try {
    const pitchSessionResult = await countReadinessPitchReviews(ventureId);
    if (parseInt(pitchSessionResult.rows[0]?.c||0) > 0) pitchScore = 50;
    const docs = await countVentureVerificationDocuments();
    if (parseInt(docs.rows[0]?.c||0) > 2) pitchScore = Math.min(100, pitchScore + 30);
  } catch { pitchScore = 0; }
  scores.pitch_readiness = pitchScore;

  // Weights for each category
  const weights = {
    startup_profile: 15, legal: 10, financial: 15, product: 10, traction: 10,
    market_validation: 10, business_model: 10, team: 10, technology: 5, pitch_readiness: 5,
  };

  let totalWeighted = 0;
  let totalWeight = 0;
  const categoryResults = [];

  for (const cat of INVESTMENT_CATEGORIES) {
    const weight = weights[cat] || 10;
    const score = scores[cat] || 0;
    totalWeighted += score * weight;
    totalWeight += weight;
    categoryResults.push({ category: cat, score, weight });
  }

  const overallScore = totalWeight > 0 ? Math.round(totalWeighted / totalWeight) : 0;
  const level = getInvestmentLevel(overallScore);

  return { overall_score: overallScore, investment_level: level.level, level_label: level.label, level_color: level.color, categories: categoryResults };
}

/**
 * Run a full assessment and store results.
 */
export async function evaluateInvestmentReadiness(ventureId) {
  const result = await calculateInvestmentReadiness(ventureId);

  // Check for existing assessment to compare
  const prev = await selectLatestAssessmentSummary(ventureId);
  const prevScore = prev.rows[0]?.overall_score || 0;
  const prevLevel = prev.rows[0]?.investment_level || "not_ready";

  // Create assessment
  const aRes = await insertAssessment(ventureId, result.overall_score, result.investment_level.level);
  const assessmentId = aRes.rows[0]?.id;

  // Insert category scores
  for (const cat of result.categories) {
    await insertAssessmentScore(assessmentId, cat.category, cat.score, cat.weight);
  }

  // Log history
  await insertInvestmentHistory(ventureId, prevScore, result.overall_score, prevLevel, result.investment_level.level);

  // Generate recommendations
  await generateRecommendations(ventureId, assessmentId, result);

  return { assessment_id: assessmentId, ...result };
}

/**
 * Generate recommendations for weak categories.
 */
export async function generateRecommendations(ventureId, assessmentId, result) {
  const weakCategories = result.categories.filter((category) => category.score < 50);

  const recommendationTemplates = {
    startup_profile: { title: "Complete Your Startup Profile", description: "Fill in all sections of the Startup Profile Wizard to improve investor confidence.", effort: "2-4 hours", impact: "high" },
    legal: { title: "Complete Legal Verification", description: "Submit business registration and legal documents for verification.", effort: "1-2 weeks", impact: "high" },
    financial: { title: "Prepare Financial Documents", description: "Upload financial statements, bank records, and tax documents.", effort: "1-2 weeks", impact: "high" },
    product: { title: "Accelerate Product Development", description: "Complete milestones and deliverable approvals to demonstrate progress.", effort: "2-4 weeks", impact: "medium" },
    traction: { title: "Build Traction Evidence", description: "Complete tasks and track KPIs to show market traction.", effort: "4-8 weeks", impact: "high" },
    market_validation: { title: "Validate Your Market", description: "Conduct market research, complete coaching sessions, and refine your industry positioning.", effort: "2-4 weeks", impact: "medium" },
    business_model: { title: "Strengthen Business Model", description: "Progress through business stages and refine your revenue model.", effort: "2-4 weeks", impact: "high" },
    team: { title: "Build Your Team", description: "Add co-founders, team members, and assign coaches/advisors.", effort: "1-4 weeks", impact: "high" },
    technology: { title: "Showcase Technology", description: "Upload prototypes and complete technical deliverables.", effort: "4-8 weeks", impact: "medium" },
    pitch_readiness: { title: "Prepare Your Pitch", description: "Schedule pitch review sessions and upload supporting documents.", effort: "1-2 weeks", impact: "medium" },
  };

  // Remove old recommendations
  await deleteOpenRecommendations(ventureId);

  for (const cat of weakCategories) {
    const tmpl = recommendationTemplates[cat.category] || { title: `Improve ${cat.category.replace(/_/g, " ")}`, description: "Focus on improving this area.", effort: "2-4 weeks", impact: "medium" };
    const priority = cat.score < 20 ? "high" : cat.score < 40 ? "medium" : "low";

    // Try to find a relevant knowledge resource
    let resourceId = null;
    try {
      const rRes = await selectResourceIdByTag(`%${cat.category.replace(/_/g, " ")}%`);
      resourceId = rRes.rows[0]?.id || null;
    } catch {}

    await insertRecommendation({
      ventureId, assessmentId, category: cat.category, priority, title: tmpl.title,
      description: tmpl.description, estimatedEffort: tmpl.effort, expectedImpact: tmpl.impact, resourceId,
    });
  }
}

/**
 * Get latest investment readiness for a venture.
 */
export async function getInvestmentReadiness(ventureId) {
  const [assessRes, recsRes, historyRes] = await Promise.all([
    selectLatestAssessment(ventureId),
    selectOpenRecommendations(ventureId),
    selectInvestmentHistory(ventureId),
  ]);

  const assessment = assessRes.rows[0] || null;
  let categories = [];
  if (assessment) {
    const catRes = await selectAssessmentScores(assessment.id);
    categories = catRes.rows || [];
  }

  const level = assessment ? getInvestmentLevel(assessment.overall_score) : getInvestmentLevel(0);

  return {
    assessment,
    categories,
    recommendations: recsRes.rows || [],
    history: historyRes.rows || [],
    level,
  };
}

/**
 * Get recommendations for a venture.
 */
export async function getInvestmentRecommendations(ventureId) {
  const res = await selectInvestmentRecommendations(ventureId);
  return res.rows || [];
}
