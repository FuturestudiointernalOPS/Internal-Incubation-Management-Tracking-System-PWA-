"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, Download, TrendingUp, Target,
  DollarSign, FileText, BarChart3, Eye, Download as DownloadIcon, Users,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

const KPI_LABELS = {
  readiness_score: "kpiInvestmentReadiness", total_matches: "kpiInvestorMatches", avg_match_score: "kpiAvgMatchScore",
  investor_engagement_score: "kpiInvestorEngagement", active_opportunities: "kpiActiveOpportunities",
  total_opportunities: "kpiTotalOpportunities", pipeline_value: "kpiPipelineValue",
  closed_investments: "kpiClosedInvestments", closed_value: "kpiClosedValue",
  win_rate: "kpiWinRate", avg_probability: "kpiAvgProbability",
  documents_uploaded: "kpiDocumentsUploaded", documents_viewed: "kpiDocumentsViewed",
  documents_downloaded: "kpiDocumentsDownloaded", pitch_deck_views: "kpiPitchDeckViews",
};

const KPI_FORMAT = {
  readiness_score: "pct", avg_match_score: "pct", investor_engagement_score: "pct",
  win_rate: "pct", avg_probability: "pct",
  pipeline_value: "currency", closed_value: "currency",
};

export default function VentureAnalyticsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [venture, setVenture] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vRes, aRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/analytics`),
      ]);
      const v = await vRes.json(); const a = await aRes.json();
      if (v.success) setVenture(v.venture);
      if (a.success) setAnalytics(a);
    } catch {} finally { setLoading(false); }
  };

  const handleExport = async () => {
    const res = await fetch(`/api/ventures/${id}/analytics?type=export&format=csv`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `investment-analytics-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const renderValue = (key, value) => {
    if (value === undefined || value === null) return "—";
    const fmt = KPI_FORMAT[key];
    if (fmt === "pct") return `${value}%`;
    if (fmt === "currency") return `$${(value).toLocaleString()}`;
    return typeof value === "number" ? value.toLocaleString() : value;
  };

  const progressBar = (pct, color) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${color || "bg-[var(--brand-orange)]"}`} style={{ width: `${Math.min(pct||0, 100)}%` }} />
    </div>
  );

  if (loading) return (
    <DashboardLayout role="super_admin"><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></DashboardLayout>
  );

  const a = analytics || {};

  // Priority KPIs for the top row
  const priorityKPIs = ["readiness_score", "total_matches", "active_opportunities", "pipeline_value", "win_rate", "investor_engagement_score"];

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.analytics.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.analytics.investmentAnalytics")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <button onClick={handleExport} className="px-4 py-2.5 rounded-xl border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
            <Download className="w-3 h-3" /> {t("vadmin.analytics.exportCsv")}
          </button>
        </div>

        {/* Priority KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {priorityKPIs.map((key) => (
            <div key={key} className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider">{t(KPI_LABELS[key] || key)}</p>
              <p className={`text-xl font-black mt-1 ${
                key === "win_rate" && (a[key]||0) >= 50 ? "text-emerald-400" :
                key === "win_rate" && (a[key]||0) < 30 ? "text-rose-400" :
                key === "readiness_score" && (a[key]||0) >= 50 ? "text-emerald-400" :
                key === "readiness_score" && (a[key]||0) < 25 ? "text-rose-400" :
                key === "investor_engagement_score" && (a[key]||0) >= 50 ? "text-emerald-400" :
                "text-[var(--text-primary)]"
              }`}>{renderValue(key, a[key])}</p>
              {["readiness_score", "win_rate", "investor_engagement_score", "avg_match_score"].includes(key) && (
                <div className="mt-2">{progressBar(a[key]||0, (a[key]||0) >= 70 ? "bg-emerald-500" : (a[key]||0) >= 40 ? "bg-amber-500" : "bg-rose-500")}</div>
              )}
            </div>
          ))}
        </div>

        {/* All KPIs Grid */}
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.analytics.allMetrics")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(KPI_LABELS).filter(([k]) => !priorityKPIs.includes(k)).map(([key, label]) => (
              <div key={key} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-wider">{t(label)}</p>
                <p className="text-base font-black mt-1">{renderValue(key, a[key])}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Funnel */}
        {(a.pipeline_funnel || []).length > 0 && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.analytics.pipelineFunnel")}</h3>
            <div className="space-y-2">
              {a.pipeline_funnel.map((stage) => {
                const maxCount = Math.max(...a.pipeline_funnel.map((s) => s.count), 1);
                const pct = (stage.count / maxCount) * 100;
                const stageLabel = stage.stage?.replace(/_/g, " ") || "";
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <span className="text-[8px] font-bold text-slate-500 w-28 capitalize truncate">{stageLabel}</span>
                    <div className="flex-1 bg-tertiary rounded-full h-6 overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full flex items-center justify-end px-3"
                        style={{ width: `${Math.max(pct, 5)}%` }}>
                        <span className="text-[8px] font-bold text-black">{stage.count}</span>
                      </div>
                    </div>
                    <span className="text-[8px] text-slate-500 w-24 text-right">${(stage.value || 0).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly Activity Trend */}
        {(a.monthly_activity || []).length > 0 && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.analytics.monthlyActivity")}</h3>
            <div className="flex items-end gap-2 h-32">
              {a.monthly_activity.slice(-6).map((m, i) => {
                const maxAct = Math.max(...a.monthly_activity.map((x) => x.activities), 1);
                const h = (m.activities / maxAct) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-[var(--brand-orange)]/30 rounded-t" style={{ height: `${h}%` }} />
                    <span className="text-[6px] text-slate-500">{m.month?.slice(5, 10) || ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Funding Trend */}
        {(a.funding_trend || []).length > 0 && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t("vadmin.analytics.fundingTrend")}</h3>
            <div className="flex items-end gap-2 h-32">
              {a.funding_trend.slice(-6).map((m, i) => {
                const maxAmt = Math.max(...a.funding_trend.map((x) => x.amount), 1);
                const h = (m.amount / maxAmt) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-emerald-500/30 rounded-t" style={{ height: `${h}%` }} />
                    <span className="text-[6px] text-slate-500">{m.month?.slice(5, 10) || ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Room Stats */}
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.analytics.dataRoomActivity")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.analytics.uploaded")}</p>
              <p className="text-lg font-black">{a.documents_uploaded || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase"><Eye className="w-3 h-3 inline" /> {t("vadmin.analytics.views")}</p>
              <p className="text-lg font-black">{a.documents_viewed || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase"><DownloadIcon className="w-3 h-3 inline" /> {t("vadmin.analytics.downloads")}</p>
              <p className="text-lg font-black">{a.documents_downloaded || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.analytics.pitchViews")}</p>
              <p className="text-lg font-black">{a.pitch_deck_views || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
