"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import {
  Search,
  FileText,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  X,
  Shield,
  Calendar,
  Briefcase,
  MapPin,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { notify } from "@/lib/notify";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_SUBMISSIONS = { submissions: [], programs: [] };

/** One read answers with both the submissions and the programmes they belong to. */
const pickSubmissions = (payload) =>
  payload?.success
    ? { submissions: payload.submissions || [], programs: payload.programs || [] }
    : EMPTY_SUBMISSIONS;

function StatusBadge({ status }) {
  const { t } = useI18n();
  const config = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    revision_requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const labels = {
    pending: t("pmMisc.submissions.statusPending"),
    approved: t("pmMisc.submissions.statusApproved"),
    rejected: t("pmMisc.submissions.statusRejected"),
    revision_requested: t("pmMisc.submissions.statusRevisionRequested"),
  };
  const statusClasses =
    config[status?.toLowerCase()] ||
    "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusClasses}`}
    >
      {status
        ? labels[status.toLowerCase()] || status.replace(/_/g, " ")
        : t("pmMisc.submissions.statusDraft")}
    </span>
  );
}

export default function PMSubmissions() {
  const _router = useRouter();
  const { t } = useI18n();

  // Who is signed in, from the shell's session cache: no request of its own, and
  // no dependence on the browser's stored copy, which is the person's RECORD id
  // where this endpoint's identifier is the SESSION one.
  const { cid } = useSessionUser();

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProgram, setFilterProgram] = useState("all");
  const [search, setSearch] = useState("");
  const [reviewModal, setReviewModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");

  // The list and the programmes it belongs to, read through the shared hook: it
  // owns the cache, the cache-first paint and the discarding of a stale answer,
  // so the page keeps no copy of its own and reads its data during render.
  const {
    data,
    loading: readLoading,
    refresh: refreshSubmissions,
  } = useApi(
    cid ? `/api/pm/submissions?assigned_pm_id=${encodeURIComponent(cid)}` : null,
    { defaultValue: EMPTY_SUBMISSIONS, transform: pickSubmissions, deps: [cid] },
  );
  const submissions = data.submissions;
  const programs = data.programs;

  // An identity that has not arrived yet is not the same as an empty one, so the
  // screen keeps its placeholder rather than claiming there is nothing to review.
  const loading = !cid || readLoading;

  // Opening the schedule dialog fills its event fields for the submission being
  // scheduled. Done where the dialog is opened rather than in an effect watching
  // it: the prefill is an event, not a consequence to be synchronised, and in an
  // effect the dialog appeared empty for a frame first.
  const openSchedule = (submission) => {
    setScheduleModal(submission);
    setEventTitle(
      t("pmMisc.submissions.eventTitlePrefill", {
        deliverable: submission.deliverable_title,
        participant: submission.participant_name,
      }),
    );
    setStartTime("");
    setEventLocation("");
  };

  const handleReview = async (submissionId, newStatus) => {
    setActionLoading(true);
    try {
      const trimmedFeedback = feedback.trim() || null;
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: submissionId,
          status: newStatus,
          review_action: newStatus === "reviewed" ? null : newStatus,
          feedback: trimmedFeedback,
          rejection_reason:
            newStatus === "rejected" ? trimmedFeedback : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data.success) {
        notify("error", data.error || t("pmMisc.submissions.reviewFailed"));
        return;
      }
      setReviewModal(null);
      setFeedback("");
      refreshSubmissions();
    } catch (error) {
      console.error("Review failed", error);
      notify("error", t("pmMisc.submissions.reviewFailed"));
    }
    setActionLoading(false);
  };

  const filtered = submissions.filter((submission) => {
    if (filterStatus !== "all" && submission.status !== filterStatus) return false;
    if (filterProgram !== "all" && submission.program_id !== filterProgram) return false;
    if (search) {
      const query = search.toLowerCase();
      const match =
        submission.deliverable_title?.toLowerCase().includes(query) ||
        submission.participant_name?.toLowerCase().includes(query) ||
        submission.participant_id?.toLowerCase().includes(query);
      if (!match) return false;
    }
    return true;
  });

  const pendingCount = submissions.filter((submission) => submission.status === "pending").length;

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("pmMisc.submissions.reviewsGrading")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("pmMisc.submissions.title")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("pmMisc.submissions.summary", {
                total: submissions.length,
                pending: pendingCount,
              })}
            </p>
          </div>
          <button
            onClick={() => refreshSubmissions()}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("pmMisc.submissions.refresh")}
          </button>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("pmMisc.submissions.searchPlaceholder")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">{t("pmMisc.submissions.allStatus")}</option>
            <option value="pending">
              {t("pmMisc.submissions.statusPending")}
            </option>
            <option value="approved">
              {t("pmMisc.submissions.statusApproved")}
            </option>
            <option value="rejected">
              {t("pmMisc.submissions.statusRejected")}
            </option>
          </select>
          <select
            value={filterProgram}
            onChange={(event) => setFilterProgram(event.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">{t("pmMisc.submissions.allPrograms")}</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </div>

        {/* Submissions List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              {search || filterStatus !== "all"
                ? t("pmMisc.submissions.noMatches")
                : t("pmMisc.submissions.noSubmissionsYet")}
            </p>
            <p className="text-xs font-bold text-[var(--text-secondary)] mt-1">
              {search || filterStatus !== "all"
                ? t("pmMisc.submissions.tryDifferentFilters")
                : t("pmMisc.submissions.submissionsWillAppear")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((submission) => (
              <div
                key={submission.id}
                className={`ios-card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all ${
                  submission.status === "pending"
                    ? "border-l-4 border-l-amber-500"
                    : ""
                }`}
              >
                <div className="flex flex-col lg:flex-row items-stretch">
                  {/* Participant Info */}
                  <div className="p-5 lg:w-64 bg-tertiary border-r border-[var(--border-primary)] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-sm font-black uppercase">
                          {(
                            submission.participant_name ||
                            submission.participant_id ||
                            "?"
                          ).charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {submission.participant_name ||
                              submission.participant_id ||
                              t("pmMisc.submissions.unknown")}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                            {submission.participant_group || submission.participant_id
                              ? t("pmMisc.submissions.groupWithName", {
                                  group: submission.participant_group || "—",
                                })
                              : ""}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={submission.status} />
                    </div>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-3">
                      {t("pmMisc.submissions.submitted")}{" "}
                      {submission.created_at
                        ? new Date(submission.created_at).toLocaleDateString()
                        : ""}
                    </p>
                  </div>

                  {/* Submission Details */}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                        {submission.deliverable_title ||
                          t("pmMisc.submissions.deliverableWithId", {
                            id: submission.deliverable_id,
                          })}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />{" "}
                          {submission.program_name ||
                            t("pmMisc.submissions.programWithId", {
                              id: submission.program_id,
                            })}
                        </span>
                        {submission.deliverable_week && (
                          <span className="text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{" "}
                            {t("pmMisc.submissions.week", {
                              week: submission.deliverable_week,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--border-primary)]">
                      {submission.file_url && (
                        <a
                          href={submission.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-blue-500/20 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />{" "}
                          {t("pmMisc.submissions.viewFile")}
                        </a>
                      )}
                      {submission.status === "pending" && (
                        <>
                          <button
                            onClick={() => setReviewModal(submission)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                          >
                            <Shield className="w-3 h-3" />{" "}
                            {submission.grading_mode === "graded"
                              ? t("pmMisc.submissions.review")
                              : t("pmMisc.submissions.feedback")}
                          </button>
                          <button
                            onClick={() => openSchedule(submission)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                          >
                            <Calendar className="w-3 h-3" />{" "}
                            {t("pmMisc.submissions.scheduleReview")}
                          </button>
                        </>
                      )}
                      {submission.status !== "pending" && (
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-auto">
                          {t("pmMisc.submissions.reviewed")}{" "}
                          {submission.reviewed_at
                            ? new Date(submission.reviewed_at).toLocaleDateString()
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setReviewModal(null)}
        >
          <div
            className="card w-full max-w-lg space-y-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
                <h3 className="text-sm font-black uppercase tracking-tight">
                  {t("pmMisc.submissions.reviewSubmission")}
                </h3>
              </div>
              <button onClick={() => setReviewModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.submissions.participant")}
                </p>
                <p className="text-sm font-bold mt-0.5">
                  {reviewModal.participant_name || reviewModal.participant_id}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.submissions.deliverable")}
                </p>
                <p className="text-sm font-bold mt-0.5">
                  {reviewModal.deliverable_title ||
                    t("pmMisc.submissions.deliverableWithId", {
                      id: reviewModal.deliverable_id,
                    })}
                </p>
              </div>
              {reviewModal.file_url && (
                <a
                  href={reviewModal.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-400 hover:brightness-110 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="text-[10px] font-bold">
                    {t("pmMisc.submissions.viewSubmissionFile")}
                  </span>
                </a>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.submissions.feedback")}
                </label>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  rows={3}
                  placeholder={t("pmMisc.submissions.feedbackPlaceholder")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              {reviewModal.grading_mode === "graded" ? (
                <>
                  <button
                    onClick={() => handleReview(reviewModal.id, "approved")}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-emerald-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />{" "}
                    {t("pmMisc.submissions.approve")}
                  </button>
                  <button
                    onClick={() =>
                      handleReview(reviewModal.id, "revision_requested")
                    }
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-blue-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />{" "}
                    {t("pmMisc.submissions.requestRevision")}
                  </button>
                  <button
                    onClick={() => handleReview(reviewModal.id, "rejected")}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-rose-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> {t("pmMisc.submissions.reject")}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleReview(reviewModal.id, "reviewed")}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-emerald-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />{" "}
                  {t("pmMisc.submissions.submitFeedback")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Review Modal */}
      {scheduleModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setScheduleModal(null)}
        >
          <div
            className="card w-full max-w-lg space-y-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-black uppercase tracking-tight">
                  {t("pmMisc.submissions.scheduleReview")}
                </h3>
              </div>
              <button onClick={() => setScheduleModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.submissions.participant")}
                </p>
                <p className="text-sm font-bold mt-0.5">
                  {scheduleModal.participant_name ||
                    scheduleModal.participant_id}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.submissions.deliverable")}
                </p>
                <p className="text-sm font-bold mt-0.5">
                  {scheduleModal.deliverable_title ||
                    t("pmMisc.submissions.deliverableWithId", {
                      id: scheduleModal.deliverable_id,
                    })}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.submissions.eventTitle")}
                </label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(event) => setEventTitle(event.target.value)}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.submissions.startTime")}
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> {t("pmMisc.submissions.location")}
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(event) => setEventLocation(event.target.value)}
                  placeholder={t("pmMisc.submissions.locationPlaceholder")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  const payload = {
                    program_id: scheduleModal.program_id,
                    participant_id: scheduleModal.participant_id,
                    title: eventTitle,
                    description: t("pmMisc.submissions.reviewMeetingFor", {
                      deliverable: scheduleModal.deliverable_title,
                    }),
                    event_type: "meeting",
                    start_time: startTime,
                    end_time: new Date(
                      new Date(startTime).getTime() + 60 * 60 * 1000,
                    ).toISOString(),
                    location: eventLocation,
                    created_by: cid,
                  };
                  try {
                    const response = await fetch("/api/events", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    if (response.ok) {
                      setScheduleModal(null);
                    }
                  } catch (err) {
                    console.error("Failed to schedule review", err);
                  }
                }}
                className="flex-1 py-3 bg-purple-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" /> {t("pmMisc.submissions.schedule")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
