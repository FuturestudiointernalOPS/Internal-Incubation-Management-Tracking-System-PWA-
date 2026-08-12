"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Trophy,
  Users,
  Target,
  BarChart3,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function ScoresPage() {
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [sort, setSort] = useState("desc");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const res = await fetch("/api/platform/forms?status=all");
      const d = await res.json();
      if (d.success) setForms(d.forms || []);
    } catch (_) {}
  };

  const fetchScores = useCallback(async () => {
    if (!selectedFormId) {
      setError("Please select a form.");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const params = new URLSearchParams({
        form_id: selectedFormId,
        sort,
      });
      if (minScore !== null && minScore !== "") params.set("min_score", minScore);
      if (maxScore !== null && maxScore !== "") params.set("max_score", maxScore);

      const res = await fetch(
        `/api/platform/ai/evaluation-scores?${params.toString()}`
      );
      const d = await res.json();
      if (d.success) {
        setData(d);
      } else {
        setError(d.error || "Failed to fetch scores.");
      }
    } catch (err) {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [selectedFormId, minScore, maxScore, sort]);

  const toggleExpand = (idx) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const exportCSV = () => {
    if (!data?.respondents?.length) return;
    const headers = ["Name", "Email", "Score", "Ranking", "Recommendation"];
    const rows = data.respondents.map((r) =>
      [
        `"${(r.name || "").replace(/"/g, '""')}"`,
        `"${(r.email || "").replace(/"/g, '""')}"`,
        r.score ?? "",
        `"${(r.ranking || "").replace(/"/g, '""')}"`,
        `"${(r.recommendation || "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation_scores_${selectedFormId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
              Platform · AI
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Evaluation Scores
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Filter, rank, and export AI evaluation scores by score threshold.
          </p>
        </div>

        {/* Controls */}
        <div className="card p-6 space-y-4">
          {/* Form selector */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Select Form
            </label>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="">Choose a form...</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dual range slider */}
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Score Range: {minScore} – {maxScore}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) =>
                  setMinScore(Math.min(Number(e.target.value), maxScore - 1))
                }
                className="w-full accent-[var(--brand-orange)] h-2"
              />
              <input
                type="range"
                min="0"
                max="100"
                value={maxScore}
                onChange={(e) =>
                  setMaxScore(Math.max(Number(e.target.value), minScore + 1))
                }
                className="w-full accent-[var(--brand-orange)] h-2"
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-[var(--text-secondary)]">0</span>
              <span className="text-[9px] text-[var(--text-secondary)]">
                100
              </span>
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-4">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Sort
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="desc">Highest First</option>
              <option value="asc">Lowest First</option>
            </select>
          </div>

          <button
            onClick={fetchScores}
            disabled={loading || !selectedFormId}
            className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Fetch Scores"
            )}
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] font-bold text-rose-500 uppercase"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Stats cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="card p-4 text-center border-l-4 border-[var(--brand-orange)]">
                  <Users className="w-4 h-4 text-[var(--brand-orange)] mx-auto mb-1" />
                  <p className="text-2xl font-black text-[var(--brand-orange)]">
                    {data.total_evaluated}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                    Total Evaluated
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-emerald-500">
                  <Target className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-2xl font-black text-emerald-500">
                    {data.qualifying_count}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                    Qualifying
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-blue-500">
                  <BarChart3 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-2xl font-black text-blue-500">
                    {data.average_score}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                    Avg Score
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-amber-500">
                  <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-2xl font-black text-amber-500">
                    {data.threshold?.min ?? 0}–{data.threshold?.max ?? 100}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                    Threshold
                  </p>
                </div>
              </div>

              {/* Export button */}
              {data.respondents?.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    Export CSV
                  </button>
                </div>
              )}

              {/* Respondents list */}
              <div className="card divide-y divide-[var(--border-primary)]">
                {data.respondents.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">
                      No respondents found in this score range.
                    </p>
                  </div>
                ) : (
                  data.respondents.map((r, i) => (
                    <div key={i}>
                      <button
                        onClick={() => toggleExpand(i)}
                        className="w-full p-4 flex items-center gap-4 hover:bg-[var(--bg-primary)] transition-colors text-left"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center">
                          <span className="text-[10px] font-black text-[var(--brand-orange)]">
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {r.name}
                          </p>
                          {r.email && (
                            <p className="text-[9px] text-[var(--text-secondary)] truncate">
                              {r.email}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p
                            className={`text-sm font-black ${
                              r.score >= 70
                                ? "text-emerald-500"
                                : r.score >= 40
                                ? "text-amber-500"
                                : "text-rose-500"
                            }`}
                          >
                            {r.score}
                          </p>
                          <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">
                            {r.ranking || "—"}
                          </p>
                        </div>
                        {expanded[i] ? (
                          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                        )}
                      </button>

                      <AnimatePresence>
                        {expanded[i] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pl-16 space-y-2">
                              <div>
                                <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                  Score
                                </span>
                                <p className="text-sm font-bold text-[var(--text-primary)]">
                                  {r.score}
                                </p>
                              </div>
                              <div>
                                <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                  Ranking
                                </span>
                                <p className="text-sm font-bold text-[var(--text-primary)]">
                                  {r.ranking || "N/A"}
                                </p>
                              </div>
                              {r.recommendation && (
                                <div>
                                  <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                    Recommendation
                                  </span>
                                  <p className="text-xs text-[var(--text-primary)] mt-1 leading-relaxed">
                                    {r.recommendation}
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
