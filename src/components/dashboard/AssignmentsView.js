"use client";

import React, { useState, useMemo } from "react";
import { useApi } from "@/lib/hooks/useApi";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Send,
  X,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";

function isSafeUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

// ─── Read shaping (module scope: built once, never per render) ───────────

// The list, with the server's own refusal folded into the value so a refused
// payload still reaches the failure panel.
const EMPTY_ASSIGNMENTS = { assignments: [], failure: null };

const pickAssignments = (payload) =>
  payload?.success
    ? { assignments: payload.assignments || [], failure: null }
    : { assignments: [], failure: payload?.error || null };

/** The programmes a list of assignments mentions, in the order it mentions them. */
function programsOf(assignments) {
  const namesById = {};
  for (const assignment of assignments) {
    if (!namesById[assignment.programId]) namesById[assignment.programId] = assignment.programName;
  }
  return Object.entries(namesById).map(([id, name]) => ({ id, name }));
}

function StatusBadge({ status }) {
  const { t } = useI18n();
  const config = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    revision_requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const statusLabels = {
    approved: t("participantMisc.assignments.statusApproved"),
    pending: t("participantMisc.assignments.statusAwaitingReview"),
    rejected: t("participantMisc.assignments.statusRejected"),
    revision_requested: t("participantMisc.assignments.statusRevisionRequested"),
    draft: t("participantMisc.assignments.statusDraft"),
  };
  const classes =
    config[status?.toLowerCase()] ||
    "bg-white/5 text-[var(--text-tertiary)] border-white/10";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${classes}`}
    >
      {statusLabels[status?.toLowerCase()] || status || statusLabels.draft}
    </span>
  );
}

export default function AssignmentsView() {
  const { t } = useI18n();
  const [filterProgram, setFilterProgram] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSubmitModal, setShowSubmitModal] = useState(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitFile, setSubmitFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // The list is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer, so this view keeps
  // no copy of its own and reads during render. Choosing another programme
  // changes the ADDRESS, which is what re-issues the read.
  const {
    data: assignmentsRead,
    loading,
    error: readError,
    refresh,
  } = useApi(
    filterProgram !== "all"
      ? `/api/participant/assignments?program_id=${filterProgram}`
      : "/api/participant/assignments",
    { defaultValue: EMPTY_ASSIGNMENTS, transform: pickAssignments },
  );
  const assignments = assignmentsRead.assignments;

  // The programme filter's options belong to the list, so they are derived from
  // it rather than stored beside it - there is then no way for the two to
  // disagree.
  const programs = useMemo(() => programsOf(assignments), [assignments]);

  const error =
    assignmentsRead.failure || (readError ? "Network error" : null);

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
        refresh();
      } else {
        setFeedback({
          type: "error",
          text: data.error || t("participantMisc.assignments.submitError"),
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: t("participantMisc.assignments.submitError"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = assignments.filter((assignment) => {
    if (filterStatus === "overdue")
      return !assignment.submission && new Date(assignment.dueDate) < new Date();
    if (filterStatus === "pending") return !assignment.submission;
    if (filterStatus === "submitted")
      return assignment.submission && assignment.submission.status === "pending";
    if (filterStatus === "approved") return assignment.submission?.status === "approved";
    if (filterStatus === "rejected") return assignment.submission?.status === "rejected";
    if (filterStatus === "revision_requested")
      return assignment.submission?.status === "revision_requested";
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-white/10 rounded" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-8 w-24 bg-white/5 rounded" />
          ))}
        </div>
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
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
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wide"
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
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          {t("participantMisc.assignments.title")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("participantMisc.assignments.summary", {
            total: assignments.length,
            pending: assignments.filter((assignment) => !assignment.submission).length,
          })}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterProgram}
          onChange={(event) => setFilterProgram(event.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
        >
          <option value="all">{t("participantMisc.assignments.filterAllPrograms")}</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
        >
          <option value="all">{t("participantMisc.assignments.filterAllStatus")}</option>
          <option value="pending">{t("participantMisc.assignments.filterPending")}</option>
          <option value="overdue">{t("participantMisc.assignments.filterOverdue")}</option>
          <option value="submitted">{t("participantMisc.assignments.filterSubmitted")}</option>
          <option value="approved">{t("participantMisc.assignments.filterApproved")}</option>
          <option value="rejected">{t("participantMisc.assignments.filterRejected")}</option>
          <option value="revision_requested">{t("participantMisc.assignments.filterRevision")}</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <FileText className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">
            {t("participantMisc.assignments.noMatches")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((assignment) => {
            const isOverdue = !assignment.submission && new Date(assignment.dueDate) < new Date();
            return (
              <div
                key={`${assignment.programId}-${assignment.id}`}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all bg-[var(--bg-tertiary)] ${
                  isOverdue
                    ? "border-rose-500/20"
                    : assignment.submission?.status === "approved"
                      ? "border-emerald-500/20"
                      : "border-[var(--border-primary)]"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isOverdue
                      ? "bg-rose-500/10"
                      : assignment.submission?.status === "approved"
                        ? "bg-emerald-500/10"
                        : "bg-white/5"
                  }`}
                >
                  {isOverdue ? (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  ) : assignment.submission?.status === "approved" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-[var(--text-tertiary)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                      {assignment.title}
                    </p>
                    {assignment.submission && (
                      <StatusBadge status={assignment.submission.status} />
                    )}
                    {isOverdue && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
                        {t("participantMisc.assignments.overdue")}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {assignment.programName}{" "}
                    {assignment.dueDate
                      ? t("participantMisc.assignments.due", {
                          date: new Date(assignment.dueDate).toLocaleDateString(),
                        })
                      : ""}
                    {assignment.submission?.score > 0
                      ? t("participantMisc.assignments.score", {
                          score: assignment.submission.score,
                        })
                      : ""}
                  </p>
                  {assignment.description && (
                    <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {assignment.description}
                    </p>
                  )}
                  {(assignment.submission?.status === "revision_requested" ||
                    assignment.submission?.status === "rejected") &&
                    (assignment.submission.feedback || assignment.submission.rejectionReason) && (
                      <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                          {t("participantMisc.assignments.feedbackLabel")}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                          {assignment.submission.rejectionReason || assignment.submission.feedback}
                        </p>
                      </div>
                    )}
                  {assignment.resourceUrl && isSafeUrl(assignment.resourceUrl) && (
                    <a
                      href={assignment.resourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--brand-orange)]/30 text-[var(--brand-orange)] text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {assignment.resourceLabel || t("participantMisc.assignments.openResource")}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {assignment.submission?.fileUrl && (
                    <a
                      href={assignment.submission.fileUrl}
                      target="_blank"
                      className="p-2 rounded-lg hover:bg-white/5 transition-all" rel="noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
                    </a>
                  )}
                  {(!assignment.submission ||
                    assignment.submission?.status === "rejected" ||
                    assignment.submission?.status === "revision_requested") && (
                    <button
                      onClick={() => {
                        setShowSubmitModal(assignment);
                        setSubmitUrl("");
                        setSubmitFile(null);
                        setFeedback(null);
                      }}
                      className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                    >
                      {assignment.submission?.status === "revision_requested"
                        ? t("participantMisc.assignments.resubmit")
                        : assignment.submission?.status === "rejected"
                          ? t("participantMisc.assignments.redo")
                          : t("participantMisc.assignments.submit")}
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
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
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
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("participantMisc.assignments.format", {
                    format: showSubmitModal.allowedFormat,
                  })}
                </p>
              )}
              {showSubmitModal.description && (
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {showSubmitModal.description}
                </p>
              )}
              {showSubmitModal.resourceUrl && isSafeUrl(showSubmitModal.resourceUrl) && (
                <a
                  href={showSubmitModal.resourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--brand-orange)]/30 text-[var(--brand-orange)] text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                >
                  <ExternalLink className="w-3 h-3" />
                  {showSubmitModal.resourceLabel || t("participantMisc.assignments.openResource")}
                </a>
              )}
              <input
                type="text"
                placeholder={t("participantMisc.assignments.urlPlaceholder")}
                value={submitUrl}
                onChange={(event) => setSubmitUrl(event.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <div className="text-[10px] font-medium text-[var(--text-secondary)] text-center">
                {t("participantMisc.assignments.orDivider")}
              </div>
              <input
                type="file"
                onChange={(event) => { setSubmitFile(event.target.files[0] || null); setSubmitUrl(""); }}
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[var(--brand-orange)] file:text-black hover:file:bg-white transition-all"
              />
              {submitFile && (
                <p className="text-[10px] font-bold text-emerald-400">
                  {t("participantMisc.assignments.selectedFile", {
                    name: submitFile.name,
                    size: (submitFile.size / 1024).toFixed(1),
                  })}
                </p>
              )}
              {feedback && (
                <p
                  className={`text-[10px] font-bold ${
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
                className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide disabled:opacity-30 flex items-center justify-center gap-2"
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
