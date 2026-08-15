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
import { useI18n } from "@/lib/i18n";

function isSafeUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

function StatusBadge({ status }) {
  const { t } = useI18n();
  const config = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  const statusLabels = {
    approved: t("participantMisc.assignments.statusApproved"),
    pending: t("participantMisc.assignments.statusPending"),
    rejected: t("participantMisc.assignments.statusRejected"),
    draft: t("participantMisc.assignments.statusDraft"),
  };
  const c =
    config[status?.toLowerCase()] ||
    "bg-white/5 text-[var(--text-tertiary)] border-white/10";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border ${c}`}
    >
      {statusLabels[status?.toLowerCase()] || status || statusLabels.draft}
    </span>
  );
}

export default function AssignmentsView() {
  const { t } = useI18n();
  const [assignments, setAssignments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterProgram, setFilterProgram] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSubmitModal, setShowSubmitModal] = useState(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitFile, setSubmitFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

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
        setError(t((data.error || "Failed to load") || "") || (data.error || "Failed to load"));
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
    if (!showSubmitModal) return;
    if (!submitUrl && !submitFile) {
      setFeedback({
        type: "error",
        text: t("participantMisc.assignments.requiredError"),
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      let fileUrl = submitUrl;

      // Upload files through the validated upload endpoint instead of
      // base64-encoding them into the JSON request body.
      if (submitFile) {
        const formData = new FormData();
        formData.append("file", submitFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          setFeedback({
            type: "error",
            text: uploadData.error || t("participantMisc.assignments.submitError"),
          });
          return;
        }
        fileUrl = uploadData.url;
      } else if (!isSafeUrl(fileUrl)) {
        setFeedback({
          type: "error",
          text: t("participantMisc.assignments.invalidUrl"),
        });
        return;
      }

      const res = await fetch("/api/participant/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: showSubmitModal.programId,
          deliverable_id: showSubmitModal.id,
          file_url: fileUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSubmitModal(null);
        setSubmitUrl("");
        setSubmitFile(null);
        setFeedback(null);
        fetchAssignments();
      } else {
        setFeedback({
          type: "error",
          text: data.error || t("participantMisc.assignments.submitError"),
        });
      }
    } catch (e) {
      setFeedback({
        type: "error",
        text: t("participantMisc.assignments.submitError"),
      });
    } finally {
      setSubmitting(false);
    }
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
          <RefreshCw className="w-3 h-3" /> {t("participantMisc.assignments.retry")}
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
          {t("participantMisc.assignments.title")}
        </h1>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          {t("participantMisc.assignments.summary", {
            total: assignments.length,
            pending: assignments.filter((a) => !a.submission).length,
          })}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterProgram}
          onChange={(e) => setFilterProgram(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
        >
          <option value="all">{t("participantMisc.assignments.filterAllPrograms")}</option>
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
          <option value="all">{t("participantMisc.assignments.filterAllStatus")}</option>
          <option value="pending">{t("participantMisc.assignments.filterPending")}</option>
          <option value="overdue">{t("participantMisc.assignments.filterOverdue")}</option>
          <option value="submitted">{t("participantMisc.assignments.filterSubmitted")}</option>
          <option value="approved">{t("participantMisc.assignments.filterApproved")}</option>
          <option value="rejected">{t("participantMisc.assignments.filterRejected")}</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
          <p className="text-[11px] font-bold text-[var(--text-secondary)]">
            {t("participantMisc.assignments.noMatches")}
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
                        {t("participantMisc.assignments.overdue")}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                    {a.programName}{" "}
                    {a.dueDate
                      ? t("participantMisc.assignments.due", {
                          date: new Date(a.dueDate).toLocaleDateString(),
                        })
                      : ""}
                    {a.submission?.score > 0
                      ? t("participantMisc.assignments.score", {
                          score: a.submission.score,
                        })
                      : ""}
                  </p>
                  {a.description && (
                    <p className="text-[9px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {a.description}
                    </p>
                  )}
                  {a.resourceUrl && isSafeUrl(a.resourceUrl) && (
                    <a
                      href={a.resourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--brand-orange)]/30 text-[var(--brand-orange)] text-[9px] font-black uppercase tracking-wider hover:brightness-110 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {a.resourceLabel || t("participantMisc.assignments.openResource")}
                    </a>
                  )}
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
                      onClick={() => {
                        setShowSubmitModal(a);
                        setSubmitUrl("");
                        setSubmitFile(null);
                        setFeedback(null);
                      }}
                      className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-wider hover:brightness-110 transition-all"
                    >
                      {t("participantMisc.assignments.submit")}
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
              className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                  {t("participantMisc.assignments.submitTitle")}
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
                  {t("participantMisc.assignments.format", {
                    format: showSubmitModal.allowedFormat,
                  })}
                </p>
              )}
              {showSubmitModal.description && (
                <p className="text-[9px] text-[var(--text-secondary)] whitespace-pre-wrap">
                  {showSubmitModal.description}
                </p>
              )}
              {showSubmitModal.resourceUrl && isSafeUrl(showSubmitModal.resourceUrl) && (
                <a
                  href={showSubmitModal.resourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--brand-orange)]/30 text-[var(--brand-orange)] text-[9px] font-black uppercase tracking-wider hover:brightness-110 transition-all"
                >
                  <ExternalLink className="w-3 h-3" />
                  {showSubmitModal.resourceLabel || t("participantMisc.assignments.openResource")}
                </a>
              )}
              <input
                type="text"
                placeholder={t("participantMisc.assignments.urlPlaceholder")}
                value={submitUrl}
                onChange={(e) => setSubmitUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <div className="text-[9px] font-bold text-[var(--text-secondary)] text-center">
                {t("participantMisc.assignments.orDivider")}
              </div>
              <input
                type="file"
                onChange={(e) => { setSubmitFile(e.target.files[0] || null); setSubmitUrl(""); }}
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-[var(--brand-orange)] file:text-black hover:file:bg-white transition-all"
              />
              {submitFile && (
                <p className="text-[9px] text-emerald-400 font-bold">
                  {t("participantMisc.assignments.selectedFile", {
                    name: submitFile.name,
                    size: (submitFile.size / 1024).toFixed(1),
                  })}
                </p>
              )}
              {feedback && (
                <p
                  className={`text-[9px] font-bold ${
                    feedback.type === "error"
                      ? "text-rose-400"
                      : "text-emerald-400"
                  }`}
                >
                  {feedback.text}
                </p>
              )}
              <button
                onClick={handleSubmit}
                disabled={(!submitUrl && !submitFile) || submitting}
                className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting
                  ? t("participantMisc.assignments.uploading")
                  : t("participantMisc.assignments.submit")}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
