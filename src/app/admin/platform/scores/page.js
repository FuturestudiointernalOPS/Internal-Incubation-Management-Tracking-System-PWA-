"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import BulkConfirmModal from "@/components/admin/platform-scores/BulkConfirmModal";
import ScoresHeader from "@/components/admin/platform-scores/ScoresHeader";
import ScoresControls from "@/components/admin/platform-scores/ScoresControls";
import ScoresStats from "@/components/admin/platform-scores/ScoresStats";
import ScoresFilters from "@/components/admin/platform-scores/ScoresFilters";
import BulkActionBar from "@/components/admin/platform-scores/BulkActionBar";
import RespondentsTable from "@/components/admin/platform-scores/RespondentsTable";

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

  const handleFormChange = (formId) => {
    setSelectedFormId(formId);
    setSelectedRunId("");
    setRuns([]);
    setData(null);
    setError("");
    clearFilters();
    if (formId) fetchRuns(formId);
  };

  const handleRunChange = (runId) => {
    setSelectedRunId(runId);
    setData(null);
    setError("");
    clearFilters();
  };

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
          <BulkConfirmModal
            showBulkConfirm={showBulkConfirm}
            pendingCount={pendingSelectedIds.length}
            bulkLoading={bulkLoading}
            onCancel={() => setShowBulkConfirm(null)}
            onConfirm={handleBulkDecision}
          />
        )}

        {/* Header */}
        <ScoresHeader />

        {/* Controls */}
        <ScoresControls
          forms={forms}
          selectedFormId={selectedFormId}
          runs={runs}
          selectedRunId={selectedRunId}
          sort={sort}
          loading={loading}
          onFormChange={handleFormChange}
          onRunChange={handleRunChange}
          onSortChange={setSort}
          onFetch={fetchScores}
        />

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
              <ScoresStats data={data} filteredStats={filteredStats} scoreFilterLabel={scoreFilterLabel} />

              {/* Search + Filters (dynamic, based on the form's actual fields) */}
              <ScoresFilters
                search={search}
                onSearchChange={setSearch}
                scoreOp={scoreOp}
                onScoreOpChange={setScoreOp}
                scoreVal={scoreVal}
                onScoreValChange={setScoreVal}
                scoreVal2={scoreVal2}
                onScoreVal2Change={setScoreVal2}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                rankingFilter={rankingFilter}
                onRankingFilterChange={setRankingFilter}
                fieldFilters={fieldFilters}
                onFieldFilterChange={(label, value) =>
                  setFieldFilters((prev) => ({ ...prev, [label]: value }))
                }
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
                data={data}
                filteredCount={filteredRespondents.length}
              />

              {/* Bulk action bar */}
              {data.respondents?.length > 0 && (
                <BulkActionBar
                  filteredRespondents={filteredRespondents}
                  pendingSelectedIds={pendingSelectedIds}
                  onSelectAll={setSelected}
                  onApprove={() => setShowBulkConfirm({ decision: "approved", count: pendingSelectedIds.length })}
                  onReject={() => setShowBulkConfirm({ decision: "rejected", count: pendingSelectedIds.length })}
                  onExport={exportCSV}
                />
              )}

              {/* Respondents list */}
              <RespondentsTable
                filteredRespondents={filteredRespondents}
                selected={selected}
                expanded={expanded}
                deciding={deciding}
                onToggleExpand={toggleExpand}
                onToggleSelect={toggleSelect}
                onDecision={handleDecision}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
