"use client";

import React, { useState, useMemo } from "react";
import { useApi } from "@/lib/hooks/useApi";
import {
  AlertCircle,
  ExternalLink,
  Send,
  X,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatLocaleDate } from "@/lib/constants";
import AppTable from "@/components/ui/AppTable";
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import { useI18n } from "@/lib/i18n";
import FiltersBar from "./assignments-view/FiltersBar";

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

export default function AssignmentsView() {
  const { t, lang } = useI18n();
  const [filterProgram, setFilterProgram] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
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
    if (![assignment.title, assignment.programName, assignment.submission?.feedback, assignment.submission?.rejectionReason].join(" ").toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
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
        <div className="h-8 w-48 bg-surface-3 rounded" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-8 w-24 bg-surface-2 rounded" />
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
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-[var(--text-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wide"
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
          {t("participant.template.shortcutsItems.assignments.title")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("participantMisc.assignments.summary", {
            total: assignments.length,
            pending: assignments.filter((assignment) => !assignment.submission).length,
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[
        [t("participant.template.toSubmit"), assignments.filter(item => !item.submission || ["rejected", "revision_requested"].includes(item.submission.status)).length],
        [t("participant.overdue"), assignments.filter(item => !item.submission && item.dueDate && new Date(item.dueDate) < new Date()).length],
        [t("participant.template.submitted"), assignments.filter(item => item.submission?.status === "pending").length],
        [t("participant.template.approved"), assignments.filter(item => item.submission?.status === "approved").length],
      ].map(([label, value]) => <AppCard key={label} padding="sm"><p className="text-xs text-[var(--text-secondary)]">{label}</p><strong className="block mt-3 text-3xl font-bold font-mono text-[var(--text-primary)]">{value}</strong></AppCard>)}</div>
      <AppInput type="search" label={t("common.search")} value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />

      {/* Filters */}
      <FiltersBar
        filterProgram={filterProgram}
        setFilterProgram={setFilterProgram}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        programs={programs}
      />

      <AppTable data={filtered} emptyMessage={t("participantMisc.assignments.noMatches")} columns={[
        { key: "title", label: t("participant.template.assignmentTitle"), render: (_, assignment) => <div><b>{assignment.title}</b>{assignment.description && <p className="mt-1 text-xs text-[var(--text-secondary)]">{assignment.description}</p>}{assignment.resourceUrl && isSafeUrl(assignment.resourceUrl) && <a href={assignment.resourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex mt-2 items-center gap-1 text-xs text-[var(--brand-orange)]"><ExternalLink className="w-3 h-3" />{assignment.resourceLabel || t("participantMisc.assignments.openResource")}</a>}</div> },
        { key: "programName", label: t("participant.template.programColumn") },
        { key: "dueDate", label: t("participant.template.dueColumn"), render: value => value ? formatLocaleDate(value, { day: "numeric", month: "short" }, lang) : t("participant.template.notAvailable") },
        { key: "status", label: t("participant.template.statusColumn"), render: (_, assignment) => <AppStatusBadge status={assignment.submission?.status || (assignment.dueDate && new Date(assignment.dueDate) < new Date() ? "blocked" : "pending")} label={t(assignment.submission ? ({approved: "participantMisc.assignments.statusApproved", pending: "participantMisc.assignments.statusAwaitingReview", rejected: "participantMisc.assignments.statusRejected", revision_requested: "participantMisc.assignments.statusRevisionRequested"}[assignment.submission.status] || "participantMisc.assignments.statusDraft") : assignment.dueDate && new Date(assignment.dueDate) < new Date() ? "participantMisc.assignments.overdue" : "participantMisc.assignments.filterPending")} /> },
        { key: "feedback", label: t("participant.template.feedbackColumn"), render: (_, assignment) => <div className="min-w-40 text-sm">{assignment.submission?.score > 0 && <b className="font-mono">{assignment.submission.score} </b>}{assignment.submission?.rejectionReason || assignment.submission?.feedback || t("participant.template.notAvailable")}</div> },
        { key: "actions", label: t("participant.template.actionsColumn"), render: (_, assignment) => <div className="flex items-center gap-2">{assignment.submission?.fileUrl && (isSafeUrl(assignment.submission.fileUrl) || /^\/(?!\/)/.test(assignment.submission.fileUrl)) && <a href={assignment.submission.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={t("participantMisc.assignments.openResource")}><ExternalLink className="h-4 w-4" /></a>}{(!assignment.submission || ["rejected", "revision_requested"].includes(assignment.submission.status)) && <AppButton size="sm" onClick={() => { setShowSubmitModal(assignment); setSubmitUrl(""); setSubmitFile(null); setFeedback(null); }}>{t(assignment.submission ? "participantMisc.assignments.resubmit" : "participantMisc.assignments.submit")}</AppButton>}</div> },
      ]} />

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
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-brand-orange/30 text-[var(--brand-orange)] text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
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
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[var(--brand-orange)] file:text-[var(--text-primary)] hover:file:bg-white transition-all"
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
                className="w-full py-3 bg-[var(--brand-orange)] text-[var(--text-primary)] rounded-xl text-sm font-bold uppercase tracking-wide disabled:opacity-30 flex items-center justify-center gap-2"
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
