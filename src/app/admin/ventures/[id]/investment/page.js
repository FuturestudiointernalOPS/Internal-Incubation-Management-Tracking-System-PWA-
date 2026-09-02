"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, TrendingUp, Target, RefreshCw,
  BookOpen, Briefcase, Shield, DollarSign, Rocket, Users, BarChart3, Lightbulb,
} from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

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
  const [venture, setVenture] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (bypassCache = false) => {
    const urls = [`/api/ventures/${id}`, `/api/ventures/${id}/investment`];
    const apply = (v, i) => {
      if (v.success) setVenture(v.venture);
      if (i.success) setData(i);
    };
    setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from
      // fresh snapshots; the assessment flow passes bypassCache=true so the
      // data always reflects the last evaluation.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1]);
          setLoading(false);
        }
      }
      const [vRes, iRes] = await Promise.all(urls.map((u) => fetch(u)));
      const v = await vRes.json(); const i = await iRes.json();
      if (v.success) cacheSet(urls[0], v);
      if (i.success) cacheSet(urls[1], i);
      apply(v, i);
    } catch {} finally { setLoading(false); }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch(`/api/ventures/${id}/investment`, { method: "POST" });
      const d = await res.json();
      if (d.success) fetchData(true);
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

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-[var(--brand-orange)]" /> Investment Readiness
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <button onClick={handleEvaluate} disabled={evaluating}
            className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-2">
            {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {evaluating ? "Evaluating..." : "Run Assessment"}
          </button>
        </div>

        {/* Score Card */}
        <div className="card">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="text-center">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl font-black border-4 ${
                overallScore >= 75 ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" :
                overallScore >= 50 ? "border-amber-500 bg-amber-500/10 text-amber-400" :
                overallScore >= 25 ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" :
                "border-rose-500 bg-rose-500/10 text-rose-400"
              }`}>
                {overallScore}
              </div>
              <div className="mt-3">
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${level.color || "text-slate-500 bg-slate-500/10"}`}>
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
                ].map((l) => (
                  <div key={l.label} className={`p-2 rounded-lg ${overallScore >= l.min && overallScore <= l.max ? "bg-[var(--brand-orange)]/10" : "bg-tertiary"}`}>
                    <p className={`text-[7px] font-black uppercase ${overallScore >= l.min && overallScore <= l.max ? l.color : "text-slate-500"}`}>{l.min}-{l.max}</p>
                    <p className={`text-[8px] font-bold ${overallScore >= l.min && overallScore <= l.max ? l.color : "text-slate-500"}`}>{l.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {categories.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Run an assessment to see category scores</p>}
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.category] || Target;
              const score = cat.score || 0;
              return (
                <div key={cat.category} className="flex items-center gap-4 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    score >= 75 ? "bg-emerald-500/10" : score >= 50 ? "bg-amber-500/10" : "bg-slate-500/10"
                  }`}>
                    <Icon className={`w-5 h-5 ${score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-slate-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{CATEGORY_LABELS[cat.category] || cat.category}</span>
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
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Recommendations
          </h3>
          {recommendations.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No recommendations yet. Run an assessment to generate them.</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((r) => (
                <div key={r.id} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                          r.priority === "high" ? "bg-rose-500/10 text-rose-400" :
                          r.priority === "medium" ? "bg-amber-500/10 text-amber-400" :
                          "bg-slate-500/10 text-slate-400"
                        }`}>{r.priority}</span>
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">{r.title}</p>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1">{r.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[8px] text-slate-500">
                        <span>⏱ {r.estimated_effort || "2-4 weeks"}</span>
                        <span>Impact: <span className={r.expected_impact === "high" ? "text-emerald-400" : r.expected_impact === "medium" ? "text-amber-400" : "text-slate-400"}>{r.expected_impact}</span></span>
                        {r.resource_id && <span className="text-[var(--brand-orange)]">📚 Resource available</span>}
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
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Score History</h3>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={h.id || i} className="flex items-center gap-4 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    h.new_score >= (h.previous_score || 0) ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  }`}>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">{h.new_score}</span>
                      {h.previous_score && <span className="text-[8px] text-slate-500">(was {h.previous_score})</span>}
                      <span className="text-[7px] text-slate-500 capitalize">{h.new_level?.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-[8px] text-slate-600">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-[8px] font-bold ${h.new_score >= (h.previous_score || 0) ? "text-emerald-400" : "text-rose-400"}`}>
                    {h.previous_score ? `${h.new_score - h.previous_score > 0 ? "+" : ""}${h.new_score - (h.previous_score || 0)}` : "—"}
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
