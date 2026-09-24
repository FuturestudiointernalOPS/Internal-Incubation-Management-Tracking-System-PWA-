"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, TrendingUp, Target, RefreshCw,
  BookOpen, Briefcase, Shield, DollarSign, Rocket, Users, BarChart3, Lightbulb,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop.
const pickVenture = (payload) => (payload?.success ? payload.venture : null);
const pickInvestment = (payload) => (payload?.success ? payload : null);
const pickRoadmapReadiness = (payload) =>
  payload?.success && payload.roadmap_readiness ? payload.roadmap_readiness : null;

const CATEGORY_ICONS = {
  startup_profile: Briefcase, legal: Shield, financial: DollarSign, product: Rocket,
  traction: TrendingUp, market_validation: Target, business_model: BarChart3,
  team: Users, technology: Rocket, pitch_readiness: BookOpen,
};

const CATEGORY_LABELS = {
  startup_profile: "Startup Profile", legal: "Legal", financial: "Financial",
  product: "Product", traction: "Traction", market_validation: "Market Validation",
  business_model: "Business Model", team: "Team", technology: "Technology",
  pitch_readiness: "Pitch Readiness",
};

export default function VentureInvestmentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [evaluating, setEvaluating] = useState(false);

  // Three reads, the venture identifier staying a plain dependency of each. Their
  // loaders' work — cache-first paint, discarding a stale response, the
  // background refresh — belongs to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect.
  const { data: venture, loading: ventureLoading } = useApi(
    `/api/ventures/${id}`,
    { transform: pickVenture, deps: [id] },
  );
  const { data, loading: assessmentLoading, refresh } = useApi(
    `/api/ventures/${id}/investment`,
    { transform: pickInvestment, deps: [id] },
  );
  // Roadmap-derived readiness (read-only, independent): the same live numbers
  // the founder sees. Fail-soft — any error just leaves the derived block hidden,
  // the recorded assessment below keeps working untouched.
  const {
    data: roadmap,
    loading: roadmapLoading,
    refresh: refreshRoadmap,
  } = useApi(`/api/ventures/${id}/investment-readiness`, {
    transform: pickRoadmapReadiness,
    deps: [id],
  });
  const loading = ventureLoading || assessmentLoading;

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const response = await fetch(`/api/ventures/${id}/investment`, { method: "POST" });
      const payload = await response.json();
      if (payload.success) { refresh(); refreshRoadmap(); }
    } catch {} finally { setEvaluating(false); }
  };

  const progressBar = (pct, color) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color || "bg-[var(--brand-orange)]"}`} style={{ width: `${Math.min(pct||0, 100)}%` }} />
    </div>
  );

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  const level = data?.level || {};
  const categories = data?.categories || [];
  const recommendations = data?.recommendations || [];
  const history = data?.history || [];
  const overallScore = data?.assessment?.overall_score ?? data?.overall_score ?? 0;

  // Same mapping as the founder-facing RoadmapReadinessCard (GrowthTabs.js):
  // live components/counts straight from the readiness engine.
  const rrComponents = roadmap?.components || {};
  const rrCounts = roadmap?.counts || {};
  const roadmapComponentRows = [
    { key: "journeys", label: t("venture.manager.irJourneys"), pct: rrComponents.journeys },
    { key: "milestones", label: t("venture.manager.irMilestones"), pct: rrComponents.milestones },
    { key: "tasks", label: t("venture.manager.irTasks"), pct: rrComponents.tasks },
    { key: "deliverables", label: t("venture.manager.irDeliverables"), pct: rrComponents.deliverables },
  ];
  const roadmapCountRows = [
    { key: "journeys", label: t("venture.manager.irJourneys"), completed: rrCounts.journeys?.completed ?? 0, total: rrCounts.journeys?.total ?? 0 },
    { key: "milestones", label: t("venture.manager.irMilestones"), completed: rrCounts.milestones?.completed ?? 0, total: rrCounts.milestones?.total ?? 0 },
    { key: "tasks", label: t("venture.manager.irTasks"), completed: rrCounts.tasks?.completed ?? 0, total: rrCounts.tasks?.total ?? 0 },
    { key: "deliverables", label: t("venture.manager.irDeliverables"), completed: rrCounts.deliverables?.approved ?? 0, total: rrCounts.deliverables?.reviewed ?? 0 },
  ];

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}`)}
              className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-[var(--brand-orange)]" /> Investment Readiness
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <button onClick={handleEvaluate} disabled={evaluating}
            className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-2">
            {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {evaluating ? "Evaluating..." : "Run Assessment"}
          </button>
        </div>

        {/* Roadmap readiness (derived) — the live numbers the Venture is
            evaluated on. Rendered first, above the recorded assessment: if the
            two disagree both are shown as-is, neither is reconciled. */}
        {roadmap ? (
          <div className="card">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
                  <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.investment.roadmapReadiness")}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("venture.manager.irTrackedDesc")}</p>
              </div>
              <span className="text-3xl font-black text-[var(--brand-orange)] shrink-0">{roadmap.overall_percent}%</span>
            </div>
            {progressBar(roadmap.overall_percent)}
            <div className="space-y-3 mt-4">
              {roadmapComponentRows.map((row) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">{row.label}</span>
                    <span className="text-[10px] font-black text-[var(--text-primary)]">{row.pct == null ? "—" : `${row.pct}%`}</span>
                  </div>
                  {row.pct != null && progressBar(row.pct)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
              {roadmapCountRows.map((row) => (
                <div key={row.key} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{row.label}</p>
                  <p className="text-sm font-black text-[var(--text-primary)] mt-0.5">
                    {row.completed}<span className="text-[var(--text-secondary)]">/{row.total}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : roadmapLoading ? (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
              <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.investment.roadmapReadiness")}
            </h3>
            <p className="text-[10px] text-[var(--text-secondary)] mt-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("common.loading")}
            </p>
          </div>
        ) : null}

        {/* Recorded assessment — the legacy manual evaluation, unchanged. */}
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("vadmin.investment.recordedAssessment")}</h2>
          <div className="flex-1 h-px bg-[var(--border-primary)]" />
        </div>

        {/* Score Card */}
        <div className="card">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="text-center">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl font-black border-4 ${
                overallScore >= 75 ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" :
                overallScore >= 50 ? "border-amber-500 bg-amber-500/10 text-amber-400" :
                overallScore >= 25 ? "border-[var(--brand-orange)] bg-brand-orange/10 text-[var(--brand-orange)]" :
                "border-rose-500 bg-rose-500/10 text-rose-400"
              }`}>
                {overallScore}
              </div>
              <div className="mt-3">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${level.color || "text-slate-500 bg-slate-500/10"}`}>
                  {level.label || "Not Ready"}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-4 w-full">
              <h3 className="text-sm font-black text-[var(--text-primary)]">Investment Readiness Score</h3>
              {progressBar(overallScore, overallScore >= 75 ? "bg-emerald-500" : overallScore >= 50 ? "bg-amber-500" : overallScore >= 25 ? "bg-[var(--brand-orange)]" : "bg-rose-500")}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                {[
                  { min: 0, max: 25, label: "Not Ready", color: "text-rose-400" },
                  { min: 26, max: 50, label: "Early Ready", color: "text-amber-400" },
                  { min: 51, max: 75, label: "Investment Ready", color: "text-emerald-400" },
                  { min: 76, max: 100, label: "Fundraising Ready", color: "text-[var(--brand-orange)]" },
                ].map((level) => (
                  <div key={level.label} className={`p-2 rounded-lg ${overallScore >= level.min && overallScore <= level.max ? "bg-brand-orange/10" : "bg-tertiary"}`}>
                    <p className={`text-[10px] font-bold uppercase ${overallScore >= level.min && overallScore <= level.max ? level.color : "text-slate-500"}`}>{level.min}-{level.max}</p>
                    <p className={`text-[10px] font-bold ${overallScore >= level.min && overallScore <= level.max ? level.color : "text-slate-500"}`}>{level.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {categories.length === 0 && <p className="text-sm text-[var(--text-secondary)] text-center py-4">Run an assessment to see category scores</p>}
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.category] || Target;
              const score = category.score || 0;
              return (
                <div key={category.category} className="flex items-center gap-4 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    score >= 75 ? "bg-emerald-500/10" : score >= 50 ? "bg-amber-500/10" : "bg-slate-500/10"
                  }`}>
                    <Icon className={`w-5 h-5 ${score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-slate-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{CATEGORY_LABELS[category.category] || category.category}</span>
                      <span className="text-[11px] font-black">{score}</span>
                    </div>
                    {progressBar(score, score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        <div className="card">
          <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4 flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Recommendations
          </h3>
          {recommendations.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">No recommendations yet. Run an assessment to generate them.</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((recommendation) => (
                <div key={recommendation.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          recommendation.priority === "high" ? "bg-rose-500/10 text-rose-400" :
                          recommendation.priority === "medium" ? "bg-amber-500/10 text-amber-400" :
                          "bg-slate-500/10 text-slate-400"
                        }`}>{recommendation.priority}</span>
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">{recommendation.title}</p>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">{recommendation.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-secondary)]">
                        <span>⏱ {recommendation.estimated_effort || "2-4 weeks"}</span>
                        <span>Impact: <span className={recommendation.expected_impact === "high" ? "text-emerald-400" : recommendation.expected_impact === "medium" ? "text-amber-400" : "text-slate-400"}>{recommendation.expected_impact}</span></span>
                        {recommendation.resource_id && <span className="text-[var(--brand-orange)]">📚 Resource available</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History Timeline */}
        {history.length > 0 && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">Score History</h3>
            <div className="space-y-2">
              {history.map((entry, index) => (
                <div key={entry.id || index} className="flex items-center gap-4 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    entry.new_score >= (entry.previous_score || 0) ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  }`}>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{entry.new_score}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">(was {entry.previous_score})</span>
                      <span className="text-[10px] text-[var(--text-secondary)] capitalize">{entry.new_level?.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)]">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-bold ${entry.new_score >= (entry.previous_score || 0) ? "text-emerald-400" : "text-rose-400"}`}>
                    {entry.previous_score ? `${entry.new_score - entry.previous_score > 0 ? "+" : ""}${entry.new_score - (entry.previous_score || 0)}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
