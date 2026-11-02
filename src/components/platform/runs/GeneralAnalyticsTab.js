"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  BarChart3,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";

export default function GeneralAnalyticsTab({ selectedRun }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchAnalytics = async () => {
    if (!selectedRun?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/ai/run-analytics?run_id=${selectedRun.id}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedRun?.id]);

  const handleCopyReport = () => {
    if (!data?.aiSynthesis?.executiveSummary) return;
    const text = `FUTURE STUDIO PORTFOLIO INTELLIGENCE REPORT
Run: ${selectedRun?.name}
Submissions: ${data?.stats?.totalSubmissions || 0} startups

EXECUTIVE SUMMARY:
${data.aiSynthesis.executiveSummary}

KEY METRICS:
${(data.aiSynthesis.topMetrics || []).map((m) => `• ${m.label}: ${m.value} (${m.sub})`).join("\n")}

QUESTION TAKEAWAYS:
${(data.aiSynthesis.questionHighlights || []).map((q) => `• ${q.question}: ${q.takeaway}`).join("\n")}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <Sparkles className="w-8 h-8 text-[var(--brand-orange)] animate-spin" />
        <p className="text-sm font-semibold text-[var(--text-secondary)]">
          Synthesizing portfolio responses & generating executive AI insights...
        </p>
      </div>
    );
  }

  if (!data || data.stats?.totalSubmissions === 0) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto space-y-3">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          No Submissions Recorded Yet
        </h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          As soon as startups or participants submit this form, the AI will automatically compute full executive insights, ratios, percentages, and strategic takeaways here.
        </p>
      </div>
    );
  }

  const { stats, aiSynthesis, questionAnalytics } = data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* ── Top Header Actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-primary)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400">
              <Sparkles className="w-3 h-3" /> AI Portfolio Intelligence
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              Updated live across {stats.totalSubmissions} submissions
            </span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1">
            General Analytics & Executive Synthesis
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <AppButton size="sm" variant="secondary" onClick={fetchAnalytics} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Re-Analyze
          </AppButton>
          <AppButton size="sm" variant="primary" onClick={handleCopyReport} className="gap-1.5 text-xs">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied Report" : "Copy Executive Brief"}
          </AppButton>
        </div>
      </div>

      {/* ── Top Metric Highlights ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Total Responses</span>
          <div className="text-2xl font-black text-[var(--text-primary)] mt-1">{stats.totalSubmissions}</div>
          <span className="text-[11px] text-emerald-400 font-medium">100% verified records</span>
        </div>

        {aiSynthesis?.topMetrics?.map((metric, i) => (
          <div key={i} className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">{metric.label}</span>
            <div className="text-2xl font-black text-[var(--brand-orange)] mt-1">{metric.value}</div>
            <span className="text-[11px] text-[var(--text-secondary)]">{metric.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Executive Synthesis Card ── */}
      {aiSynthesis?.executiveSummary && (
        <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-[var(--surface-1)] to-[var(--surface-2)] p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2.5 text-orange-400 font-bold text-sm">
            <Lightbulb className="w-5 h-5 text-[var(--brand-orange)]" />
            <h3>Executive Leadership Brief</h3>
          </div>
          <div className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-line space-y-3 font-normal">
            {aiSynthesis.executiveSummary}
          </div>
        </div>
      )}

      {/* ── Question-by-Question Strategic Takeaways ── */}
      {aiSynthesis?.questionHighlights && aiSynthesis.questionHighlights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Key Question Takeaways
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiSynthesis.questionHighlights.map((qh, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] space-y-1">
                <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">
                  {qh.question}
                </h4>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {qh.takeaway}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Statistical Distribution Breakdown ── */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Question Responses & Distributions
        </h3>
        <div className="space-y-3">
          {questionAnalytics.map((q) => {
            const hasFreq = Object.keys(q.frequencies || {}).length > 0;
            const topEntries = Object.entries(q.frequencies || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6);

            return (
              <div key={q.field_id} className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">{q.label}</h4>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">
                      Type: {q.type} · Answered by {q.answeredCount} startups
                    </span>
                  </div>
                  {q.average !== null && (
                    <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 font-bold text-xs">
                      Avg: {q.average}
                    </span>
                  )}
                </div>

                {hasFreq && (
                  <div className="space-y-1.5 pt-1">
                    {topEntries.map(([opt, count]) => {
                      const pct = Math.round((count / (q.answeredCount || 1)) * 100);
                      return (
                        <div key={opt} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[var(--text-primary)] font-medium truncate max-w-md">{opt}</span>
                            <span className="text-[var(--text-secondary)]">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-[var(--surface-2)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[var(--brand-orange)] h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
