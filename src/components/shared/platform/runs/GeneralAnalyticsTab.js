"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  BarChart3,
  Download,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useApi } from "@/lib/hooks/useApi";
import { downloadExecutiveSummaryPdf } from "./reportPdf";

/**
 * General analytics for one form run.
 *
 * Two speeds on purpose:
 *
 *   the NUMBERS  → aggregated by the server, deterministic, read through the
 *                  shared hook (so switching tabs does not re-ask);
 *   the SYNTHESIS→ an AI call, which costs money and seconds, so it is asked for
 *                  on a button and never on mount.
 *
 * A failed numbers request is reported as a failure, not as "no submissions" —
 * the two used to look identical.
 */
const pickStats = (payload) => (payload?.success ? payload : null);

export default function GeneralAnalyticsTab({ selectedRun }) {
  const runId = selectedRun?.id;

  const { data, loading, error, status, refresh } = useApi(
    runId ? `/api/platform/ai/run-analytics?run_id=${runId}` : null,
    { defaultValue: null, transform: pickStats, deps: [runId] },
  );

  // The synthesis is keyed to the run it was generated for, so switching runs
  // simply stops matching — no reset effect, and no stale brief on another run.
  const [aiState, setAiState] = useState({ runId: null, data: null, failed: false });
  const [aiLoading, setAiLoading] = useState(false);
  const abortRef = useRef(null);
  const ai = aiState.runId === runId ? aiState.data : null;
  const aiFailed = aiState.runId === runId ? aiState.failed : false;

  // Leaving the tab cancels the generation instead of letting it finish into a
  // component that no longer exists.
  useEffect(() => () => abortRef.current?.abort(), []);

  const generateInsights = useCallback(async () => {
    if (!runId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAiLoading(true);
    try {
      const response = await fetch(
        `/api/platform/ai/run-analytics?run_id=${runId}&ai=1`,
        { signal: controller.signal },
      );
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "failed");
      setAiState({ runId, data: json.aiSynthesis || null, failed: !json.aiSynthesis });
    } catch (generationError) {
      if (generationError?.name !== "AbortError") {
        setAiState({ runId, data: null, failed: true });
      }
    } finally {
      if (!controller.signal.aborted) setAiLoading(false);
    }
  }, [runId]);

  const handleDownloadReport = () => {
    if (!ai?.executiveSummary) return;
    downloadExecutiveSummaryPdf({ selectedRun, data, ai });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-8 h-8 text-[var(--brand-orange)] animate-spin" />
        <p className="text-sm font-semibold text-[var(--text-secondary)]">
          Loading responses and computing the figures…
        </p>
      </div>
    );
  }

  // A failed read is NOT an empty run. Say which one it is.
  if (!data) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto space-y-3">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          Could not load the analytics
        </h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {error || (status ? `The request failed (${status}).` : "The request did not answer.")}
        </p>
        <AppButton size="sm" variant="secondary" onClick={() => refresh()}>
          Retry
        </AppButton>
      </div>
    );
  }

  if (data.stats?.totalSubmissions === 0) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto space-y-3">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          No Submissions Recorded Yet
        </h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          As soon as startups or participants submit this form, the figures appear here and
          the executive synthesis can be generated.
        </p>
      </div>
    );
  }

  const { stats, questionAnalytics } = data;
  const hasInsights = Boolean(ai?.executiveSummary);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* ── Top Header Actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-primary)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400">
              <Sparkles className="w-3 h-3" /> Portfolio Intelligence
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
          <AppButton size="sm" variant="secondary" onClick={() => refresh()} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh figures
          </AppButton>
          <AppButton
            size="sm"
            variant="secondary"
            onClick={generateInsights}
            disabled={aiLoading}
            className="gap-1.5 text-xs"
          >
            <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Generating…" : hasInsights ? "Regenerate insights" : "Generate insights"}
          </AppButton>
          <AppButton
            size="sm"
            variant="primary"
            onClick={handleDownloadReport}
            disabled={!hasInsights}
            className="gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download Executive Summary
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

        {ai?.topMetrics?.map((metric, index) => (
          <div key={index} className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">{metric.label}</span>
            <div className="text-2xl font-black text-[var(--brand-orange)] mt-1">{metric.value}</div>
            <span className="text-[11px] text-[var(--text-secondary)]">{metric.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Executive Synthesis: a generation the reader asks for ── */}
      {hasInsights ? (
        <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-[var(--surface-1)] to-[var(--surface-2)] p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2.5 text-orange-400 font-bold text-sm">
            <Lightbulb className="w-5 h-5 text-[var(--brand-orange)]" />
            <h3>Executive Leadership Brief</h3>
          </div>
          <div className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-line space-y-3 font-normal">
            {ai.executiveSummary}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border-primary)] bg-[var(--surface-1)] p-6">
          <div className="flex items-center gap-2.5 text-sm font-bold text-[var(--text-primary)]">
            <Lightbulb className="w-5 h-5 text-[var(--brand-orange)]" />
            <h3>Executive Leadership Brief</h3>
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            The figures below are computed from every response. The brief is written by the
            model on request — it costs a call, so it is not generated automatically.
          </p>
          {aiFailed && (
            <p className="mt-2 text-xs text-rose-400">
              The synthesis could not be generated. Try again.
            </p>
          )}
          <div className="mt-3">
            <AppButton
              size="sm"
              variant="primary"
              onClick={generateInsights}
              disabled={aiLoading}
              className="gap-1.5 text-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
              {aiLoading ? "Generating…" : "Generate insights"}
            </AppButton>
          </div>
        </div>
      )}

      {/* ── Question-by-Question Strategic Takeaways ── */}
      {ai?.questionHighlights && ai.questionHighlights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Key Question Takeaways
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ai.questionHighlights.map((highlight, index) => (
              <div key={index} className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] space-y-1">
                <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">
                  {highlight.question}
                </h4>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {highlight.takeaway}
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
          {questionAnalytics.map((question) => {
            const hasFrequency = Object.keys(question.frequencies || {}).length > 0;
            const topEntries = Object.entries(question.frequencies || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6);

            return (
              <div key={question.field_id} className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">{question.label}</h4>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase">
                      Type: {question.type} · Answered by {question.answeredCount} startups
                    </span>
                  </div>
                  {question.average !== null && (
                    <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 font-bold text-xs">
                      Avg: {question.average}
                    </span>
                  )}
                </div>

                {hasFrequency && (
                  <div className="space-y-1.5 pt-1">
                    {topEntries.map(([option, count]) => {
                      const percent = Math.round((count / (question.answeredCount || 1)) * 100);
                      return (
                        <div key={option} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[var(--text-primary)] font-medium truncate max-w-md">{option}</span>
                            <span className="text-[var(--text-secondary)]">{count} ({percent}%)</span>
                          </div>
                          <div className="w-full bg-[var(--surface-2)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[var(--brand-orange)] h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
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
