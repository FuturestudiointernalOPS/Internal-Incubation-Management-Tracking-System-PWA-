"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Send,
  X,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function StatusBadge({ status }) {
  const config = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  const c =
    config[status?.toLowerCase()] ||
    "bg-white/5 text-[var(--text-tertiary)] border-white/10";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border ${c}`}
    >
      {status || "draft"}
    </span>
  );
}

export default function AssignmentsView() {
  const [assignments, setAssignments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterProgram, setFilterProgram] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSubmitModal, setShowSubmitModal] = useState(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url =
        filterProgram !== "all"
          ? `/api/participant/assignments?program_id=${filterProgram}`
          : "/api/participant/assignments";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments || []);
        // Extract unique programs
        const progMap = {};
        (data.assignments || []).forEach((a) => {
          if (!progMap[a.programId]) progMap[a.programId] = a.programName;
        });
        setPrograms(
          Object.entries(progMap).map(([id, name]) => ({ id, name })),
        );
      } else {
        setError(data.error || "Failed to load");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [filterProgram]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSubmit = async () => {
    if (!submitUrl || !showSubmitModal) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/participant/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: showSubmitModal.programId,
          deliverable_id: showSubmitModal.id,
          file_url: submitUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSubmitModal(null);
        setSubmitUrl("");
        fetchAssignments();
      }
    } catch (e) {
      /* ignore */
    }
    setSubmitting(false);
  };

  const filtered = assignments.filter((a) => {
    if (filterStatus === "overdue")
      return !a.submission && new Date(a.dueDate) < new Date();
    if (filterStatus === "pending") return !a.submission;
    if (filterStatus === "submitted")
      return a.submission && a.submission.status === "pending";
    if (filterStatus === "approved") return a.submission?.status === "approved";
    if (filterStatus === "rejected") return a.submission?.status === "rejected";
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-white/10 rounded" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-24 bg-white/5 rounded" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-[12px] text-[var(--text-secondary)]">{error}</p>
        <button
          onClick={fetchAssignments}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
          Assignments
        </h1>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          {assignments.length} total ·{" "}
          {assignments.filter((a) => !a.submission).length} pending
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterProgram}
          onChange={(e) => setFilterProgram(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
        >
          <option value="all">All Programs</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
          <p className="text-[11px] font-bold text-[var(--text-secondary)]">
            No assignments match your filters
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const isOverdue = !a.submission && new Date(a.dueDate) < new Date();
            return (
              <div
                key={`${a.programId}-${a.id}`}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all bg-[var(--bg-tertiary)] ${
                  isOverdue
                    ? "border-rose-500/20"
                    : a.submission?.status === "approved"
                      ? "border-emerald-500/20"
                      : "border-[var(--border-primary)]"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isOverdue
                      ? "bg-rose-500/10"
                      : a.submission?.status === "approved"
                        ? "bg-emerald-500/10"
                        : "bg-white/5"
                  }`}
                >
                  {isOverdue ? (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  ) : a.submission?.status === "approved" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-[var(--text-tertiary)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">
                      {a.title}
                    </p>
                    {a.submission && (
                      <StatusBadge status={a.submission.status} />
                    )}
                    {isOverdue && (
                      <span className="text-[8px] font-black text-rose-400 uppercase tracking-wider">
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                    {a.programName}{" "}
                    {a.dueDate
                      ? `· Due ${new Date(a.dueDate).toLocaleDateString()}`
                      : ""}
                    {a.submission?.score > 0
                      ? `· Score: ${a.submission.score}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.submission?.fileUrl && (
                    <a
                      href={a.submission.fileUrl}
                      target="_blank"
                      className="p-2 rounded-lg hover:bg-white/5 transition-all"
                    >
                      <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
                    </a>
                  )}
                  {!a.submission && (
                    <button
                      onClick={() => setShowSubmitModal(a)}
                      className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-wider hover:brightness-110 transition-all"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <div
            className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowSubmitModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                  Submit Assignment
                </h3>
                <button onClick={() => setShowSubmitModal(null)}>
                  <X className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>
              </div>
              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                {showSubmitModal.title}
              </p>
              {showSubmitModal.allowedFormat && (
                <p className="text-[9px] text-[var(--text-secondary)]">
                  Format: {showSubmitModal.allowedFormat}
                </p>
              )}
              <input
                type="text"
                placeholder="Paste your submission URL or file link..."
                value={submitUrl}
                onChange={(e) => setSubmitUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <button
                onClick={handleSubmit}
                disabled={!submitUrl || submitting}
                className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
