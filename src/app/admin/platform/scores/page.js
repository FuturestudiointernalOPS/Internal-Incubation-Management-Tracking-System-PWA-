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
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

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

  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

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
      setError(t("adminMisc.platformScores.errorSelectForm"));
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

      const res = await fetch(
        `/api/platform/ai/evaluation-scores?${params.toString()}`
      );
      const d = await res.json();
      if (d.success) {
        setData(d);
        setSelected({});
      } else {
        setError(d.error || t("adminMisc.platformScores.fetchFailed"));
      }
    } catch (err) {
      setError(t("adminMisc.platformScores.networkError"));
    } finally {
      setLoading(false);
    }
  }, [selectedFormId, sort]);

  const toggleExpand = (idx) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleSelect = (submissionId) => {
    setSelected((prev) => ({ ...prev, [submissionId]: !prev[submissionId] }));
  };

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
    const bodyRows = rows.map((r) =>
      [
        `"${(r.name || "").replace(/"/g, '""')}"`,
        `"${(r.email || "").replace(/"/g, '""')}"`,
        r.score ?? "",
        `"${(r.ranking || "").replace(/"/g, '""')}"`,
        `"${(r.recommendation || "").replace(/"/g, '""')}"`,
        r.status || "",
      ].join(",")
    );
    const csv = [headers.join(","), ...bodyRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation_scores_${selectedFormId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    const q = search.trim().toLowerCase();
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
    const activeFieldFilters = Object.entries(fieldFilters).filter(([, v]) => v);

    return rows.filter((r) => {
      if (q) {
        const hay = [
          r.name || "",
          r.email || "",
          ...Object.values(r.answers || {}),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const score = Number(r.score);
      if (!scorePass(isNaN(score) ? 0 : score)) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (rankingFilter && (r.ranking || "") !== rankingFilter) return false;
      for (const [label, val] of activeFieldFilters) {
        const actual = String(r.answers?.[label] ?? "").trim().toLowerCase();
        if (actual !== String(val).trim().toLowerCase()) return false;
      }
      return true;
    });
  }, [data, search, scoreOp, scoreVal, scoreVal2, statusFilter, rankingFilter, fieldFilters]);

  const filteredStats = useMemo(() => {
    const rows = filteredRespondents;
    if (rows.length === 0) return { qualifying: 0, average: 0 };
    const sum = rows.reduce((s, r) => s + (Number(r.score) || 0), 0);
    return {
      qualifying: rows.length,
      average: Math.round((sum / rows.length) * 10) / 10,
    };
  }, [filteredRespondents]);

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
      const res = await fetch("/api/platform/form-runs?action=review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId, decision }),
      });
      const d = await res.json();
      if (d.success) {
        notify(decision === "approved" ? t("adminMisc.platformScores.approvedToast") : t("adminMisc.platformScores.rejectedToast"));
        fetchScores();
      } else {
        notify(d.error || t("adminMisc.platformScores.decisionFailed"));
      }
    } catch (_) {
      notify(t("adminMisc.platformScores.networkError"));
    }
    setDeciding(null);
  };

  // Bulk decision
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const pendingSelectedIds = selectedIds.filter(
    (sid) =>
      filteredRespondents.find((r) => String(r.submission_id) === sid)?.status ===
      "submitted"
  );

  const handleBulkDecision = async () => {
    if (!showBulkConfirm) return;
    const { decision } = showBulkConfirm;
    setBulkLoading(true);
    let done = 0;
    for (const sid of pendingSelectedIds) {
      try {
        await fetch("/api/platform/form-runs?action=review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submission_id: parseInt(sid), decision }),
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
    fetchScores();
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {notification && (
          <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase animate-in">
            {notification}
          </div>
        )}

        {/* Bulk confirm modal */}
        {showBulkConfirm && (
          <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center p-6" onClick={() => setShowBulkConfirm(null)}>
            <div className="card w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <ShieldAlert className={`w-6 h-6 ${showBulkConfirm.decision === "approved" ? "text-emerald-500" : "text-rose-500"}`} />
                <h3 className="text-lg font-black uppercase text-[var(--text-primary)]">
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
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
              {t("adminMisc.platformScores.eyebrow")}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
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
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              {t("adminMisc.platformScores.selectForm")}
            </label>
            <select
              value={selectedFormId}
              onChange={(e) => {
                setSelectedFormId(e.target.value);
                setData(null);
                setError("");
                clearFilters();
              }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="">{t("adminMisc.platformScores.chooseForm")}</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-4">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              {t("adminMisc.platformScores.sort")}
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="desc">{t("adminMisc.platformScores.sortDesc")}</option>
              <option value="asc">{t("adminMisc.platformScores.sortAsc")}</option>
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
              <div className="grid grid-cols-4 gap-4">
                <div className="card p-4 text-center border-l-4 border-[var(--brand-orange)]">
                  <Users className="w-4 h-4 text-[var(--brand-orange)] mx-auto mb-1" />
                  <p className="text-2xl font-black text-[var(--brand-orange)]">
                    {data.total_evaluated}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                    {t("adminMisc.platformScores.statTotalEvaluated")}
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-emerald-500">
                  <Target className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-2xl font-black text-emerald-500">
                    {filteredStats.qualifying}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                    {t("adminMisc.platformScores.statQualifying")}
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-blue-500">
                  <BarChart3 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-2xl font-black text-blue-500">
                    {filteredStats.average}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                    {t("adminMisc.platformScores.statAvgScore")}
                  </p>
                </div>
                <div className="card p-4 text-center border-l-4 border-amber-500">
                  <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-2xl font-black text-amber-500">
                    {scoreFilterLabel}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
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
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search respondents (name, email, answers)..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-[var(--text-secondary)]">
                    <Filter className="w-3 h-3" /> Filters
                  </span>

                  {/* Score filter with numeric operators */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={scoreOp}
                      onChange={(e) => setScoreOp(e.target.value)}
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
                          onChange={(e) => setScoreVal(e.target.value)}
                          placeholder="80"
                          className="w-16 px-2 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                        />
                        {scoreOp === "between" && (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={scoreVal2}
                            onChange={(e) => setScoreVal2(e.target.value)}
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
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                  >
                    <option value="">Status: All</option>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        Status: {t(cfg.label)}
                      </option>
                    ))}
                  </select>

                  {/* Ranking filter (actual values in the dataset) */}
                  {(data.rankings || []).length > 0 && (
                    <select
                      value={rankingFilter}
                      onChange={(e) => setRankingFilter(e.target.value)}
                      className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                    >
                      <option value="">Result: All</option>
                      {data.rankings.map((rk) => (
                        <option key={rk} value={rk}>
                          Result: {rk}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Dynamic field filters — from the form's actual columns */}
                  {(data.filterable_fields || []).map((f) => (
                    <select
                      key={f.label}
                      value={fieldFilters[f.label] || ""}
                      onChange={(e) =>
                        setFieldFilters((prev) => ({ ...prev, [f.label]: e.target.value }))
                      }
                      className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                    >
                      <option value="">{f.label}: All</option>
                      {f.options.map((o, idx) => (
                        <option key={`${f.label}-${idx}`} value={String(o)}>
                          {f.label}: {String(o)}
                        </option>
                      ))}
                    </select>
                  ))}

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="px-2.5 py-2 rounded-lg bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase hover:bg-rose-500/20"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <p className="text-[9px] font-bold text-[var(--text-secondary)]">
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
                        checked={pendingSelectedIds.length === filteredRespondents.filter((r) => r.status === "submitted").length && filteredRespondents.some((r) => r.status === "submitted")}
                        onChange={(e) => {
                          const next = {};
                          filteredRespondents.forEach((r) => {
                            if (r.status === "submitted") next[r.submission_id] = e.target.checked;
                          });
                          setSelected(next);
                        }}
                        className="accent-[var(--brand-orange)]"
                      />
                      {t("adminMisc.platformScores.selectAllPending", { count: filteredRespondents.filter((r) => r.status === "submitted").length })}
                    </label>
                  </div>
                  {pendingSelectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {t("adminMisc.platformScores.selectedCount", { count: pendingSelectedIds.length })}
                      </span>
                      <button
                        onClick={() => setShowBulkConfirm({ decision: "approved", count: pendingSelectedIds.length })}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:brightness-110"
                      >
                        {t("adminMisc.platformScores.approve")}
                      </button>
                      <button
                        onClick={() => setShowBulkConfirm({ decision: "rejected", count: pendingSelectedIds.length })}
                        className="px-3 py-2 rounded-xl bg-rose-600 text-white text-[9px] font-black uppercase hover:brightness-110"
                      >
                        {t("adminMisc.platformScores.reject")}
                      </button>
                    </div>
                  )}
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    {t("adminMisc.platformScores.exportCsv")}
                  </button>
                </div>
              )}

              {/* Respondents list */}
              <div className="card divide-y divide-[var(--border-primary)]">
                {filteredRespondents.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {t("adminMisc.platformScores.noRespondents")}
                    </p>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="mt-3 text-[10px] font-black uppercase text-[var(--brand-orange)] hover:underline">
                        Clear all filters
                      </button>
                    )}
                  </div>
                ) : (
                  filteredRespondents.map((r, i) => (
                    <div key={i}>
                      <div
                        onClick={() => toggleExpand(i)}
                        className="w-full p-4 flex items-center gap-4 hover:bg-[var(--bg-primary)] transition-colors text-left cursor-pointer"
                      >
                        {r.status === "submitted" && (
                          <input
                            type="checkbox"
                            checked={!!selected[r.submission_id]}
                            onChange={() => toggleSelect(r.submission_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0 accent-[var(--brand-orange)]"
                          />
                        )}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center">
                          <span className="text-[10px] font-black text-[var(--brand-orange)]">
                            {i + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {r.name}
                          </p>
                          <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">
                            {r.ranking || "—"}
                          </p>
                        </div>
                        {/* Email column — the address that receives the emails */}
                        <div className="hidden md:block w-56 min-w-0 flex-shrink-0">
                          <p
                            className="text-[9px] text-[var(--text-secondary)] truncate"
                            title={r.email || "No email"}
                          >
                            {r.email || "—"}
                          </p>
                        </div>
                        {(STATUS_CONFIG[r.status] || STATUS_CONFIG.submitted) && (
                          <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase flex-shrink-0 ${STATUS_CONFIG[r.status].bg} ${STATUS_CONFIG[r.status].color}`}>
                            {t(STATUS_CONFIG[r.status].label)}
                          </span>
                        )}
                        <div className="text-right flex-shrink-0 w-16">
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
                            score
                          </p>
                        </div>
                        {expanded[i] ? (
                          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
                        )}
                      </div>

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
                                  {t("adminMisc.platformScores.detailScore")}
                                </span>
                                <p className="text-sm font-bold text-[var(--text-primary)]">
                                  {r.score}
                                </p>
                              </div>
                              <div>
                                <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                  {t("adminMisc.platformScores.detailRanking")}
                                </span>
                                <p className="text-sm font-bold text-[var(--text-primary)]">
                                  {r.ranking || t("adminMisc.platformScores.na")}
                                </p>
                              </div>
                              {r.recommendation && (
                                <div>
                                  <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                                    {t("adminMisc.platformScores.detailRecommendation")}
                                  </span>
                                  <p className="text-xs text-[var(--text-primary)] mt-1 leading-relaxed">
                                    {r.recommendation}
                                  </p>
                                </div>
                              )}

                              {/* Decision actions */}
                              {r.status === "submitted" ? (
                                <div className="flex items-center gap-2 pt-2">
                                  <button
                                    onClick={() => handleDecision(r.submission_id, "approved")}
                                    disabled={deciding?.submission_id === r.submission_id}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:brightness-110 disabled:opacity-40"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    {deciding?.submission_id === r.submission_id && deciding?.decision === "approved" ? "..." : t("adminMisc.platformScores.approve")}
                                  </button>
                                  <button
                                    onClick={() => handleDecision(r.submission_id, "rejected")}
                                    disabled={deciding?.submission_id === r.submission_id}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-[9px] font-black uppercase hover:brightness-110 disabled:opacity-40"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    {deciding?.submission_id === r.submission_id && deciding?.decision === "rejected" ? "..." : t("adminMisc.platformScores.reject")}
                                  </button>
                                </div>
                              ) : (
                                <div className="pt-2">
                                  <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${STATUS_CONFIG[r.status]?.bg} ${STATUS_CONFIG[r.status]?.color}`}>
                                    {t(STATUS_CONFIG[r.status]?.label) || r.status}
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
    </DashboardLayout>
  );
}
