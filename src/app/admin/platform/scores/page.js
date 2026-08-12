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
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const STATUS_CONFIG = {
  submitted: { label: "Pending Review", color: "text-amber-500", bg: "bg-amber-500/10" },
  approved: { label: "Approved", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  rejected: { label: "Rejected", color: "text-rose-500", bg: "bg-rose-500/10" },
  revision_requested: { label: "Revision", color: "text-blue-500", bg: "bg-blue-500/10" },
  draft: { label: "Draft", color: "text-slate-500", bg: "bg-slate-500/10" },
};

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
        setSelected({});
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

  const toggleSelect = (submissionId) => {
    setSelected((prev) => ({ ...prev, [submissionId]: !prev[submissionId] }));
  };

  const exportCSV = () => {
    if (!data?.respondents?.length) return;
    const headers = ["Name", "Email", "Score", "Ranking", "Recommendation", "Status"];
    const rows = data.respondents.map((r) =>
      [
        `"${(r.name || "").replace(/"/g, '""')}"`,
        `"${(r.email || "").replace(/"/g, '""')}"`,
        r.score ?? "",
        `"${(r.ranking || "").replace(/"/g, '""')}"`,
        `"${(r.recommendation || "").replace(/"/g, '""')}"`,
        r.status || "",
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
        notify(decision === "approved" ? "Applicant approved — group + activation email sent" : "Applicant rejected — history retained");
        fetchScores();
      } else {
        notify(d.error || "Decision failed");
      }
    } catch (_) {
      notify("Network error");
    }
    setDeciding(null);
  };

  // Bulk decision
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const pendingSelectedIds = selectedIds.filter(
    (sid) => data?.respondents?.find((r) => String(r.submission_id) === sid)?.status === "submitted"
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
    notify(`${done} applicant${done === 1 ? "" : "s"} ${decision === "approved" ? "approved" : "rejected"}`);
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
                  {showBulkConfirm.decision === "approved" ? "Approve" : "Reject"} {pendingSelectedIds.length} applicant{pendingSelectedIds.length === 1 ? "" : "s"}?
                </h3>
              </div>
              {showBulkConfirm.decision === "approved" ? (
                <div className="space-y-2 text-[10px] font-bold text-[var(--text-secondary)]">
                  <p>✓ Each applicant's existing CRM Contact will be assigned to the Bootcamp Group linked to the Form Run</p>
                  <p>✓ Platform credentials will be created (pending password setup)</p>
                  <p>✓ Activation email will be sent to each applicant</p>
                  <p>✓ CRM timeline updated for each contact</p>
                </div>
              ) : (
                <div className="space-y-2 text-[10px] font-bold text-[var(--text-secondary)]">
                  <p>✗ No Group assignment</p>
                  <p>✗ No activation email</p>
                  <p>✓ Form response, CRM contact, and evaluation history are retained</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowBulkConfirm(null)} className="flex-1 btn btn-secondary" disabled={bulkLoading}>
                  Cancel
                </button>
                <button
                  onClick={handleBulkDecision}
                  disabled={bulkLoading}
                  className={`flex-1 btn ${showBulkConfirm.decision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"} text-white`}
                >
                  {bulkLoading ? "Processing..." : "Confirm"}
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

              {/* Bulk action bar */}
              {data.respondents?.length > 0 && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      <input
                        type="checkbox"
                        checked={pendingSelectedIds.length === data.respondents.filter((r) => r.status === "submitted").length && data.respondents.some((r) => r.status === "submitted")}
                        onChange={(e) => {
                          const next = {};
                          data.respondents.forEach((r) => {
                            if (r.status === "submitted") next[r.submission_id] = e.target.checked;
                          });
                          setSelected(next);
                        }}
                        className="accent-[var(--brand-orange)]"
                      />
                      Select all pending ({data.respondents.filter((r) => r.status === "submitted").length})
                    </label>
                  </div>
                  {pendingSelectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {pendingSelectedIds.length} selected
                      </span>
                      <button
                        onClick={() => setShowBulkConfirm({ decision: "approved", count: pendingSelectedIds.length })}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:brightness-110"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setShowBulkConfirm({ decision: "rejected", count: pendingSelectedIds.length })}
                        className="px-3 py-2 rounded-xl bg-rose-600 text-white text-[9px] font-black uppercase hover:brightness-110"
                      >
                        Reject
                      </button>
                    </div>
                  )}
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
                          {r.email && (
                            <p className="text-[9px] text-[var(--text-secondary)] truncate">
                              {r.email}
                            </p>
                          )}
                        </div>
                        {(STATUS_CONFIG[r.status] || STATUS_CONFIG.submitted) && (
                          <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase flex-shrink-0 ${STATUS_CONFIG[r.status].bg} ${STATUS_CONFIG[r.status].color}`}>
                            {STATUS_CONFIG[r.status].label}
                          </span>
                        )}
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

                              {/* Decision actions */}
                              {r.status === "submitted" ? (
                                <div className="flex items-center gap-2 pt-2">
                                  <button
                                    onClick={() => handleDecision(r.submission_id, "approved")}
                                    disabled={deciding?.submission_id === r.submission_id}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase hover:brightness-110 disabled:opacity-40"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    {deciding?.submission_id === r.submission_id && deciding?.decision === "approved" ? "..." : "Approve"}
                                  </button>
                                  <button
                                    onClick={() => handleDecision(r.submission_id, "rejected")}
                                    disabled={deciding?.submission_id === r.submission_id}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-[9px] font-black uppercase hover:brightness-110 disabled:opacity-40"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    {deciding?.submission_id === r.submission_id && deciding?.decision === "rejected" ? "..." : "Reject"}
                                  </button>
                                </div>
                              ) : (
                                <div className="pt-2">
                                  <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${STATUS_CONFIG[r.status]?.bg} ${STATUS_CONFIG[r.status]?.color}`}>
                                    {STATUS_CONFIG[r.status]?.label || r.status}
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
