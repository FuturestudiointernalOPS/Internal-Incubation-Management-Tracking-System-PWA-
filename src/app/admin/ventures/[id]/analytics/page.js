"use client";

import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Download, FileText, BarChart3, Eye, Download as DownloadIcon,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";

const KPI_LABELS = {
  readiness_score: "Investment Readiness", total_matches: "Investor Matches", avg_match_score: "Avg Match Score",
  investor_engagement_score: "Investor Engagement", active_opportunities: "Active Opportunities",
  total_opportunities: "Total Opportunities", pipeline_value: "Pipeline Value",
  closed_investments: "Closed Investments", closed_value: "Closed Value",
  win_rate: "Win Rate", avg_probability: "Avg Probability",
  documents_uploaded: "Documents Uploaded", documents_viewed: "Documents Viewed",
  documents_downloaded: "Documents Downloaded", pitch_deck_views: "Pitch Deck Views",
};

const KPI_FORMAT = {
  readiness_score: "pct", avg_match_score: "pct", investor_engagement_score: "pct",
  win_rate: "pct", avg_probability: "pct",
  pipeline_value: "currency", closed_value: "currency",
};

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop.
const pickVenture = (payload) => (payload?.success ? payload.venture : null);
const pickVentureAnalytics = (payload) => (payload?.success ? payload : null);

export default function VentureAnalyticsPage() {
  const { id } = useParams();
  const router = useRouter();
  // Both reads — and the cache-first paint they used to gate on together —
  // belong to the hook, so the screen keeps no data state of its own and never
  // sets state from an effect. Two separate reads keep the venture identifier a
  // plain dependency rather than a list rebuilt on every render.
  const { data: venture, loading: ventureLoading } = useApi(
    `/api/ventures/${id}`,
    { transform: pickVenture, deps: [id] },
  );
  const { data: analytics, loading: analyticsLoading } = useApi(
    `/api/ventures/${id}/analytics`,
    { transform: pickVentureAnalytics, deps: [id] },
  );
  const loading = ventureLoading || analyticsLoading;

  const handleExport = async () => {
    const response = await fetch(`/api/ventures/${id}/analytics?type=export&format=csv`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a"); downloadLink.href = url; downloadLink.download = `investment-analytics-${id}.csv`; downloadLink.click();
    URL.revokeObjectURL(url);
  };

  const renderValue = (key, value) => {
    if (value === undefined || value === null) return "—";
    const format = KPI_FORMAT[key];
    if (format === "pct") return `${value}%`;
    if (format === "currency") return `$${(value).toLocaleString()}`;
    return typeof value === "number" ? value.toLocaleString() : value;
  };

  const progressBar = (percentage, color) => (
    <div className="w-full bg-tertiary rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${color || "bg-[var(--brand-orange)]"}`} style={{ width: `${Math.min(percentage||0, 100)}%` }} />
    </div>
  );

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  const analyticsData = analytics || {};

  // Priority KPIs for the top row
  const priorityKPIs = ["readiness_score", "total_matches", "active_opportunities", "pipeline_value", "win_rate", "investor_engagement_score"];

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
              <BarChart3 className="w-6 h-6 text-[var(--brand-orange)]" /> Investment Analytics
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <button onClick={handleExport} className="px-4 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>

        {/* Priority KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {priorityKPIs.map((key) => (
            <div key={key} className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{KPI_LABELS[key] || key}</p>
              <p className={`text-xl font-black mt-1 ${
                key === "win_rate" && (analyticsData[key]||0) >= 50 ? "text-emerald-400" :
                key === "win_rate" && (analyticsData[key]||0) < 30 ? "text-rose-400" :
                key === "readiness_score" && (analyticsData[key]||0) >= 50 ? "text-emerald-400" :
                key === "readiness_score" && (analyticsData[key]||0) < 25 ? "text-rose-400" :
                key === "investor_engagement_score" && (analyticsData[key]||0) >= 50 ? "text-emerald-400" :
                "text-[var(--text-primary)]"
              }`}>{renderValue(key, analyticsData[key])}</p>
              {["readiness_score", "win_rate", "investor_engagement_score", "avg_match_score"].includes(key) && (
                <div className="mt-2">{progressBar(analyticsData[key]||0, (analyticsData[key]||0) >= 70 ? "bg-emerald-500" : (analyticsData[key]||0) >= 40 ? "bg-amber-500" : "bg-rose-500")}</div>
              )}
            </div>
          ))}
        </div>

        {/* All KPIs Grid */}
        <div className="card">
          <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">All Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(KPI_LABELS).filter(([kpiKey]) => !priorityKPIs.includes(kpiKey)).map(([key, label]) => (
              <div key={key} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{label}</p>
                <p className="text-base font-black mt-1">{renderValue(key, analyticsData[key])}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Funnel */}
        {(analyticsData.pipeline_funnel || []).length > 0 && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">Pipeline Funnel</h3>
            <div className="space-y-2">
              {analyticsData.pipeline_funnel.map((stage) => {
                const maxCount = Math.max(...analyticsData.pipeline_funnel.map((funnelStage) => funnelStage.count), 1);
                const percentage = (stage.count / maxCount) * 100;
                const stageLabel = stage.stage?.replace(/_/g, " ") || "";
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] w-28 capitalize truncate">{stageLabel}</span>
                    <div className="flex-1 bg-tertiary rounded-full h-6 overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full flex items-center justify-end px-3"
                        style={{ width: `${Math.max(percentage, 5)}%` }}>
                        <span className="text-[10px] font-bold text-black">{stage.count}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] w-24 text-right">${(stage.value || 0).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly Activity Trend */}
        {(analyticsData.monthly_activity || []).length > 0 && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">Monthly Activity</h3>
            <div className="flex items-end gap-2 h-32">
              {analyticsData.monthly_activity.slice(-6).map((month, index) => {
                const maxActivities = Math.max(...analyticsData.monthly_activity.map((entry) => entry.activities), 1);
                const barHeight = (month.activities / maxActivities) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-[var(--brand-orange)]/30 rounded-t" style={{ height: `${barHeight}%` }} />
                    <span className="text-[10px] text-[var(--text-secondary)]">{month.month?.slice(5, 10) || ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Funding Trend */}
        {(analyticsData.funding_trend || []).length > 0 && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">Funding Trend (Closed Deals)</h3>
            <div className="flex items-end gap-2 h-32">
              {analyticsData.funding_trend.slice(-6).map((month, index) => {
                const maxAmount = Math.max(...analyticsData.funding_trend.map((entry) => entry.amount), 1);
                const barHeight = (month.amount / maxAmount) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-emerald-500/30 rounded-t" style={{ height: `${barHeight}%` }} />
                    <span className="text-[10px] text-[var(--text-secondary)]">{month.month?.slice(5, 10) || ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Data Room Stats */}
        <div className="card">
          <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Data Room Activity
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Uploaded</p>
              <p className="text-lg font-black">{analyticsData.documents_uploaded || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase"><Eye className="w-3 h-3 inline" /> Views</p>
              <p className="text-lg font-black">{analyticsData.documents_viewed || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase"><DownloadIcon className="w-3 h-3 inline" /> Downloads</p>
              <p className="text-lg font-black">{analyticsData.documents_downloaded || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Pitch Views</p>
              <p className="text-lg font-black">{analyticsData.pitch_deck_views || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
