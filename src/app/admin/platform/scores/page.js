"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Search,
  Filter,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const STATUS_CONFIG = {
  submitted: { label: "adminMisc.platformScores.statusSubmitted", color: "text-amber-500", bg: "bg-amber-500/10" },
  approved: { label: "adminMisc.platformScores.statusApproved", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  rejected: { label: "adminMisc.platformScores.statusRejected", color: "text-rose-500", bg: "bg-rose-500/10" },
  revision_requested: { label: "adminMisc.platformScores.statusRevision", color: "text-blue-500", bg: "bg-blue-500/10" },
  draft: { label: "adminMisc.platformScores.statusDraft", color: "text-slate-500", bg: "bg-slate-500/10" },
};

export default function ScoresPage() {
  const { t } = useI18n();
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [sort, setSort] = useState("desc");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  // Search + filters (client-side over the fetched dataset — instant, no reload)
  const [search, setSearch] = useState("");
  const [scoreOp, setScoreOp] = useState(""); // "" | "eq" | "gte" | "gt" | "lte" | "lt" | "between"
  const [scoreVal, setScoreVal] = useState("");
  const [scoreVal2, setScoreVal2] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rankingFilter, setRankingFilter] = useState("");
  const [fieldFilters, setFieldFilters] = useState({}); // field label → option value

  // Approval state
  const [selected, setSelected] = useState({});
  const [deciding, setDeciding] = useState(null); // { submission_id, decision }
  const [showBulkConfirm, setShowBulkConfirm] = useState(null); // { decision, count }
  const [bulkLoading, setBulkLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const notify = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchForms = async (bypassCache = false) => {
    const url = "/api/platform/forms?status=all";
    const apply = (payload) => {
      if (payload.success) setForms(payload.forms || []);
    };
    try {
      // Cache-first paint: the form dropdown renders instantly from a fresh
      // snapshot; the network refresh keeps it current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const payload = await response.json();
      if (payload.success) {
        cacheSet(url, payload);
        apply(payload);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchRuns = async (formId) => {
    try {
      const response = await fetch(`/api/platform/form-runs?form_id=${formId}`);
      const payload = await response.json();
      if (payload.success) setRuns(payload.runs || []);
    } catch (_) {}
  };

  const fetchScores = useCallback(async (bypassCache = false) => {
    if (!selectedRunId) {
      setError(t("adminMisc.platformScores.errorSelectRun"));
      return;
    }
    setLoading(true);
    setError("");
    setData(null);

    const params = new URLSearchParams({
      run_id: selectedRunId,
      form_id: selectedFormId,
      sort,
    });
    const url = `/api/platform/ai/evaluation-scores?${params.toString()}`;
    const apply = (payload) => {
      setData(payload);
      setSelected({});
    };
    let painted = false;
    try {
      // Cache-first paint: re-fetching the same run/form renders instantly
      // from a fresh snapshot; decision mutations pass bypassCache=true so
      // the table always reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
          painted = true;
        }
      }
      const response = await fetch(url);
      const payload = await response.json();
      if (payload.success) {
        cacheSet(url, payload);
        apply(payload);
      } else {
        setError(t((payload.error || t("adminMisc.platformScores.fetchFailed")) || "") || (payload.error || t("adminMisc.platformScores.fetchFailed")));
      }
    } catch {
      if (!painted) setError(t("adminMisc.platformScores.networkError"));
    }
    // The loading flag is cleared here rather than in a `finally`: the `catch`
    // above absorbs every failure, so the two are equivalent - and a `finally`
    // is a construct the React Compiler cannot build HIR for, which is what
    // kept this reader out of compilation.
    setLoading(false);
  }, [selectedRunId, selectedFormId, sort, t]);

  const toggleExpand = (rowIndex) => {
    setExpanded((prev) => ({ ...prev, [rowIndex]: !prev[rowIndex] }));
  };

  const toggleSelect = (submissionId) => {
    setSelected((prev) => ({ ...prev, [submissionId]: !prev[submissionId] }));
  };

  // ── Client-side search + filtering (against the actual fetched dataset) ──
  const scoreFilterLabel = useMemo(() => {
    if (!scoreOp || scoreVal === "") return "All";
    const OP_LABELS = { eq: "= ", gte: "≥ ", gt: "> ", lte: "≤ ", lt: "< " };
    if (scoreOp === "between") return `${scoreVal}–${scoreVal2 || "…"}%`;
    return `${OP_LABELS[scoreOp] || ""}${scoreVal}%`;
  }, [scoreOp, scoreVal, scoreVal2]);

  const filteredRespondents = useMemo(() => {
    const rows = data?.respondents || [];
    const normalizedQuery = search.trim().toLowerCase();
    const v1 = parseFloat(scoreVal);
    const v2 = parseFloat(scoreVal2);
    const hasScore = !!scoreOp && !isNaN(v1);
    const scorePass = (score) => {
      if (!hasScore) return true;
      switch (scoreOp) {
        case "eq": return score === v1;
        case "gte": return score >= v1;
        case "gt": return score > v1;
        case "lte": return score <= v1;
        case "lt": return score < v1;
        case "between": return !isNaN(v2) ? score >= v1 && score <= v2 : score >= v1;
        default: return true;
      }
    };
    const activeFieldFilters = Object.entries(fieldFilters).filter(([, value]) => value);

    return rows.filter((respondent) => {
      if (normalizedQuery) {
        const hay = [
          respondent.name || "",
          respondent.email || "",
          ...Object.values(respondent.answers || {}),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      const score = Number(respondent.score);
      if (!scorePass(isNaN(score) ? 0 : score)) return false;
      if (statusFilter && respondent.status !== statusFilter) return false;
      if (rankingFilter && (respondent.ranking || "") !== rankingFilter) return false;
      for (const [label, value] of activeFieldFilters) {
        const actual = String(respondent.answers?.[label] ?? "").trim().toLowerCase();
        if (actual !== String(value).trim().toLowerCase()) return false;
      }
      return true;
    });
  }, [data, search, scoreOp, scoreVal, scoreVal2, statusFilter, rankingFilter, fieldFilters]);

  const filteredStats = useMemo(() => {
    const rows = filteredRespondents;
    if (rows.length === 0) return { qualifying: 0, average: 0 };
    const sum = rows.reduce((total, respondent) => total + (Number(respondent.score) || 0), 0);
    return {
      qualifying: rows.length,
      average: Math.round((sum / rows.length) * 10) / 10,
    };
  }, [filteredRespondents]);

  // The export reads the filtered list, so it is declared after it. A plain
  // function declared BEFORE the memo it reads made the React Compiler merge
  // both into one reactive scope, where its own internal marker landed inside
  // a scope the memoisation check had not registered yet - so the check
  // reported the memo as "not preserved" and skipped the component.
  const exportCSV = () => {
    const rows = filteredRespondents;
    if (!rows.length) return;
    const headers = [
      t("adminMisc.platformScores.csvName"),
      t("adminMisc.platformScores.csvEmail"),
      t("adminMisc.platformScores.csvScore"),
      t("adminMisc.platformScores.csvRanking"),
      t("adminMisc.platformScores.csvRecommendation"),
      t("adminMisc.platformScores.csvStatus"),
    ];
    const bodyRows = rows.map((respondent) =>
      [
        `"${(respondent.name || "").replace(/"/g, '""')}"`,
        `"${(respondent.email || "").replace(/"/g, '""')}"`,
        respondent.score ?? "",
        `"${(respondent.ranking || "").replace(/"/g, '""')}"`,
        `"${(respondent.recommendation || "").replace(/"/g, '""')}"`,
        respondent.status || "",
      ].join(",")
    );
    const csv = [headers.join(","), ...bodyRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `evaluation_scores_run_${selectedRunId || selectedFormId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = !!(
    search.trim() ||
    (scoreOp && scoreVal !== "") ||
    statusFilter ||
    rankingFilter ||
    Object.values(fieldFilters).some(Boolean)
  );

  const clearFilters = () => {
    setSearch("");
    setScoreOp("");
    setScoreVal("");
    setScoreVal2("");
    setStatusFilter("");
    setRankingFilter("");
    setFieldFilters({});
  };

  // Single decision
  const handleDecision = async (submissionId, decision) => {
    setDeciding({ submission_id: submissionId, decision });
    try {
      const response = await fetch("/api/platform/form-runs?action=review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId, decision }),
      });
      const payload = await response.json();
      if (payload.success) {
        notify(decision === "approved" ? t("adminMisc.platformScores.approvedToast") : t("adminMisc.platformScores.rejectedToast"));
        fetchScores(true);
      } else {
        notify(t((payload.error || t("adminMisc.platformScores.decisionFailed")) || "") || (payload.error || t("adminMisc.platformScores.decisionFailed")));
      }
    } catch (_) {
      notify(t("adminMisc.platformScores.networkError"));
    }
    setDeciding(null);
  };

  // Bulk decision
  const selectedIds = Object.keys(selected).filter((submissionId) => selected[submissionId]);
  const pendingSelectedIds = selectedIds.filter(
    (submissionId) =>
      filteredRespondents.find((respondent) => String(respondent.submission_id) === submissionId)?.status ===
      "submitted"
  );

  const handleBulkDecision = async () => {
    if (!showBulkConfirm) return;
    const { decision } = showBulkConfirm;
    setBulkLoading(true);
    let done = 0;
    for (const submissionId of pendingSelectedIds) {
      try {
        await fetch("/api/platform/form-runs?action=review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submission_id: parseInt(submissionId), decision }),
        });
        done++;
      } catch (_) {}
    }
    setBulkLoading(false);
    setShowBulkConfirm(null);
    notify(
      decision === "approved"
        ? done === 1
          ? t("adminMisc.platformScores.bulkApprovedOne", { count: done })
          : t("adminMisc.platformScores.bulkApprovedMany", { count: done })
        : done === 1
          ? t("adminMisc.platformScores.bulkRejectedOne", { count: done })
          : t("adminMisc.platformScores.bulkRejectedMany", { count: done })
    );
    fetchScores(true);
  };

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {notification && (
          <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase animate-in">
            {notification}
          </div>
        )}

        {/* Bulk confirm modal */}
        {showBulkConfirm && (
          <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center p-6" onClick={() => setShowBulkConfirm(null)}>
            <div className="card w-full max-w-md p-6 space-y-5" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center gap-3">
                <ShieldAlert className={`w-6 h-6 ${showBulkConfirm.decision === "approved" ? "text-emerald-500" : "text-rose-500"}`} />
                <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
                  {showBulkConfirm.decision === "approved"
                    ? pendingSelectedIds.length === 1
                      ? t("adminMisc.platformScores.bulkApproveTitleOne", { count: pendingSelectedIds.length })
                      : t("adminMisc.platformScores.bulkApproveTitleMany", { count: pendingSelectedIds.length })
                    : pendingSelectedIds.length === 1
                      ? t("adminMisc.platformScores.bulkRejectTitleOne", { count: pendingSelectedIds.length })
                      : t("adminMisc.platformScores.bulkRejectTitleMany", { count: pendingSelectedIds.length })}
                </h3>
              </div>
              {showBulkConfirm.decision === "approved" ? (
                <div className="space-y-2 text-[10px] font-bold text-[var(--text-secondary)]">
                  <p>{t("adminMisc.platformScores.bulkApproveBullet1")}</p>
                  <p>{t("adminMisc.platformScores.bulkApproveBullet2")}</p>
                  <p>{t("adminMisc.platformScores.bulkApproveBullet3")}</p>
                  <p>{t("adminMisc.platformScores.bulkApproveBullet4")}</p>
                </div>
              ) : (
                <div className="space-y-2 text-[10px] font-bold text-[var(--text-secondary)]">
                  <p>{t("adminMisc.platformScores.bulkRejectBullet1")}</p>
                  <p>{t("adminMisc.platformScores.bulkRejectBullet2")}</p>
                  <p>{t("adminMisc.platformScores.bulkRejectBullet3")}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowBulkConfirm(null)} className="flex-1 btn btn-secondary" disabled={bulkLoading}>
                  {t("adminMisc.platformScores.cancel")}
                </button>
                <button
                  onClick={handleBulkDecision}
                  disabled={bulkLoading}
                  className={`flex-1 btn ${showBulkConfirm.decision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} text-white`}
                >
                  {bulkLoading ? t("adminMisc.platformScores.processing") : t("adminMisc.platformScores.confirm")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {t("adminMisc.platformScores.eyebrow")}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {t("adminMisc.platformScores.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformScores.subtitle")}
          </p>
        </div>

        {/* Controls */}
        <div className="card p-6 space-y-4">
          {/* Form selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
              {t("adminMisc.platformScores.selectForm")}
            </label>
            <select
              value={selectedFormId}
              onChange={(event) => {
                setSelectedFormId(event.target.value);
                setSelectedRunId("");
                setRuns([]);
                setData(null);
                setError("");
                clearFilters();
                if (event.target.value) fetchRuns(event.target.value);
              }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="">{t("adminMisc.platformScores.chooseForm")}</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </div>

          {/* Run selector — evaluations are scoped to THIS run */}
          {selectedFormId && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                {t("adminMisc.platformScores.selectRun")}
              </label>
              <select
                value={selectedRunId}
                onChange={(event) => {
                  setSelectedRunId(event.target.value);
                  setData(null);
                  setError("");
                  clearFilters();
                }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("adminMisc.platformScores.chooseRun")}</option>
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.name || `${t("adminMisc.platformScores.runFallback")} #${run.id}`} ({run.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div className="flex items-center gap-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("adminMisc.platformScores.sort")}
            </label>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="desc">{t("adminMisc.platformScores.sortDesc")}</option>
              <option value="asc">{t("adminMisc.platformScores.sortAsc")}</option>
            </select>
          </div>

          <button
            onClick={fetchScores}
            disabled={loading || !selectedRunId}
            className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("adminMisc.platformScores.loading")}
              </>
            ) : (
              t("adminMisc.platformScores.fetchScores")
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card p-4 text-center border-l-4 border-[var(--brand-orange)]">
                  <Users className="w-4 h-4 text-[var(--brand-orange)] mx-auto mb-1" />
                  <p className="text-2xl font-black tracking-tight text-[var(--brand-orange)]">
                    {data.total_evaluated}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                    {t("adminMisc.platformScores.statTotalEvaluated")}
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-emerald-500">
                  <Target className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-2xl font-black tracking-tight text-emerald-500">
                    {filteredStats.qualifying}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                    {t("adminMisc.platformScores.statQualifying")}
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-blue-500">
                  <BarChart3 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-2xl font-black tracking-tight text-blue-500">
                    {filteredStats.average}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                    {t("adminMisc.platformScores.statAvgScore")}
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-amber-500">
                  <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-2xl font-black tracking-tight text-amber-500">
                    {scoreFilterLabel}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                    {t("adminMisc.platformScores.statThreshold")}
                  </p>
                </div>
              </div>

              {/* Search + Filters (dynamic, based on the form's actual fields) */}
              <div className="card p-4 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search respondents (name, email, answers)..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    <Filter className="w-3 h-3" /> Filters
                  </span>

                  {/* Score filter with numeric operators */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={scoreOp}
                      onChange={(event) => setScoreOp(event.target.value)}
                      className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                    >
                      <option value="">Score: All</option>
                      <option value="gte">Score ≥</option>
                      <option value="gt">Score &gt;</option>
                      <option value="eq">Score =</option>
                      <option value="lte">Score ≤</option>
                      <option value="lt">Score &lt;</option>
                      <option value="between">Score Between</option>
                    </select>
                    {scoreOp && (
                      <>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={scoreVal}
                          onChange={(event) => setScoreVal(event.target.value)}
                          placeholder="80"
                          className="w-16 px-2 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                        />
                        {scoreOp === "between" && (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={scoreVal2}
                            onChange={(event) => setScoreVal2(event.target.value)}
                            placeholder="90"
                            className="w-16 px-2 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                          />
                        )}
                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">%</span>
                      </>
                    )}
                  </div>

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                  >
                    <option value="">Status: All</option>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        Status: {t(config.label)}
                      </option>
                    ))}
                  </select>

                  {/* Ranking filter (actual values in the dataset) */}
                  {(data.rankings || []).length > 0 && (
                    <select
                      value={rankingFilter}
                      onChange={(event) => setRankingFilter(event.target.value)}
                      className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                    >
                      <option value="">Result: All</option>
                      {data.rankings.map((ranking) => (
                        <option key={ranking} value={ranking}>
                          Result: {ranking}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Dynamic field filters — from the form's actual columns */}
                  {(data.filterable_fields || []).map((field) => (
                    <select
                      key={field.label}
                      value={fieldFilters[field.label] || ""}
                      onChange={(event) =>
                        setFieldFilters((prev) => ({ ...prev, [field.label]: event.target.value }))
                      }
                      className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                    >
                      <option value="">{field.label}: All</option>
                      {field.options.map((option, optionIndex) => (
                        <option key={`${field.label}-${optionIndex}`} value={String(option)}>
                          {field.label}: {String(option)}
                        </option>
                      ))}
                    </select>
                  ))}

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="px-2.5 py-2 rounded-lg bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {data.run?.name ? (
                    <>{t("adminMisc.platformScores.runLabel")}: <span className="text-[var(--brand-orange)] font-bold">{data.run.name}</span> · </>
                  ) : null}
                  Showing {filteredRespondents.length} of {data.respondents?.length || 0} respondents
                </p>
              </div>

              {/* Bulk action bar */}
              {data.respondents?.length > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      <input
                        type="checkbox"
                        checked={pendingSelectedIds.length === filteredRespondents.filter((respondent) => respondent.status === "submitted").length && filteredRespondents.some((respondent) => respondent.status === "submitted")}
                        onChange={(event) => {
                          const next = {};
                          filteredRespondents.forEach((respondent) => {
                            if (respondent.status === "submitted") next[respondent.submission_id] = event.target.checked;
                          });
                          setSelected(next);
                        }}
                        className="accent-[var(--brand-orange)]"
                      />
                      {t("adminMisc.platformScores.selectAllPending", { count: filteredRespondents.filter((respondent) => respondent.status === "submitted").length })}
                    </label>
                  </div>
                  {pendingSelectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {t("adminMisc.platformScores.selectedCount", { count: pendingSelectedIds.length })}
                      </span>
                      <button
                        onClick={() => setShowBulkConfirm({ decision: "approved", count: pendingSelectedIds.length })}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold uppercase tracking-wide hover:brightness-110"
                      >
                        {t("adminMisc.platformScores.approve")}
                      </button>
                      <button
                        onClick={() => setShowBulkConfirm({ decision: "rejected", count: pendingSelectedIds.length })}
                        className="px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold uppercase tracking-wide hover:brightness-110"
                      >
                        {t("adminMisc.platformScores.reject")}
                      </button>
                    </div>
                  )}
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-500/20 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    {t("adminMisc.platformScores.exportCsv")}
                  </button>
                </div>
              )}

              {/* Respondents list */}
              <div className="card divide-y divide-[var(--border-primary)]">
                {/* Column header strip — S/N is a presentation-level row number */}
                <div className="flex items-center gap-4 px-4 py-2 bg-[var(--bg-primary)]">
                  <span className="w-8 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.platformScores.colSn")}</span>
                  <span className="w-4" />
                  <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.platformScores.colApplicant")}</span>
                  <span className="hidden md:block w-56 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.platformScores.csvEmail")}</span>
                  <span className="flex-shrink-0 w-16 sm:w-20 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    <span className="hidden sm:inline">{t("adminMisc.platformScores.csvStatus")}</span>
                  </span>
                  <span className="flex-shrink-0 w-12 sm:w-16 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("adminMisc.platformScores.csvScore")}</span>
                  <span className="w-4" />
                </div>
                {filteredRespondents.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {t("adminMisc.platformScores.noRespondents")}
                    </p>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline">
                        Clear all filters
                      </button>
                    )}
                  </div>
                ) : (
                  filteredRespondents.map((respondent, index) => (
                    <div key={index}>
                      <div
                        onClick={() => toggleExpand(index)}
                        className="w-full p-4 flex items-center gap-4 hover:bg-[var(--bg-primary)] transition-colors text-left cursor-pointer"
                      >
                        {/* S/N — continuous row number over the filtered result set */}
                        <div className="w-8 flex-shrink-0 text-center">
                          <span className="text-[10px] font-bold text-[var(--text-secondary)]">{index + 1}</span>
                        </div>
                        <div className="w-4 flex-shrink-0 flex items-center justify-center">
                          {respondent.status === "submitted" && (
                            <input
                              type="checkbox"
                              checked={!!selected[respondent.submission_id]}
                              onChange={() => toggleSelect(respondent.submission_id)}
                              onClick={(event) => event.stopPropagation()}
                              className="accent-[var(--brand-orange)]"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                            {respondent.name}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                            {respondent.ranking || "—"}
                          </p>
                        </div>
                        {/* Email column — the address that receives the emails */}
                        <div className="hidden md:block w-56 min-w-0 flex-shrink-0">
                          <p
                            className="text-[10px] font-medium text-[var(--text-secondary)] truncate"
                            title={respondent.email || "No email"}
                          >
                            {respondent.email || "—"}
                          </p>
                        </div>
                        <div className="flex-shrink-0 w-16 sm:w-20 flex items-center justify-center">
                          {(STATUS_CONFIG[respondent.status] || STATUS_CONFIG.submitted) && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_CONFIG[respondent.status].bg} ${STATUS_CONFIG[respondent.status].color}`}>
                              {t(STATUS_CONFIG[respondent.status].label)}
                            </span>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 w-12 sm:w-16">
                          <p
                            className={`text-sm font-black ${
                              respondent.score >= 70
                                ? "text-emerald-500"
                                : respondent.score >= 40
                                ? "text-amber-500"
                                : "text-rose-500"
                            }`}
                          >
                            {respondent.score}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                            {t("adminMisc.platformScores.detailScore")}
                          </p>
                        </div>
                        {expanded[index] ? (
                          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                        )}
                      </div>

                      <AnimatePresence>
                        {expanded[index] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pl-16 space-y-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("adminMisc.platformScores.detailScore")}
                                </span>
                                <p className="text-sm font-bold text-[var(--text-primary)]">
                                  {respondent.score}
                                </p>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {t("adminMisc.platformScores.detailRanking")}
                                </span>
                                <p className="text-sm font-bold text-[var(--text-primary)]">
                                  {respondent.ranking || t("adminMisc.platformScores.na")}
                                </p>
                              </div>
                              {respondent.recommendation && (
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                    {t("adminMisc.platformScores.detailRecommendation")}
                                  </span>
                                  <p className="text-sm text-[var(--text-primary)] mt-1 leading-relaxed">
                                    {respondent.recommendation}
                                  </p>
                                </div>
                              )}

                              {/* Decision actions */}
                              {respondent.status === "submitted" ? (
                                <div className="flex items-center gap-2 pt-2">
                                  <button
                                    onClick={() => handleDecision(respondent.submission_id, "approved")}
                                    disabled={deciding?.submission_id === respondent.submission_id}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    {deciding?.submission_id === respondent.submission_id && deciding?.decision === "approved" ? "..." : t("adminMisc.platformScores.approve")}
                                  </button>
                                  <button
                                    onClick={() => handleDecision(respondent.submission_id, "rejected")}
                                    disabled={deciding?.submission_id === respondent.submission_id}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    {deciding?.submission_id === respondent.submission_id && deciding?.decision === "rejected" ? "..." : t("adminMisc.platformScores.reject")}
                                  </button>
                                </div>
                              ) : (
                                <div className="pt-2">
                                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STATUS_CONFIG[respondent.status]?.bg} ${STATUS_CONFIG[respondent.status]?.color}`}>
                                    {t(STATUS_CONFIG[respondent.status]?.label) || respondent.status}
                                  </span>
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
    </>
  );
}
