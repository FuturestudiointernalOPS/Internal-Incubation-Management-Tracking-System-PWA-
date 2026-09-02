"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  ExternalLink,
  Search,
  Shield,
  ArrowRight,
  MessageSquare,
  Calendar,
  RefreshCw,
  FileText,
  User,
  Send,
  AlertCircle,
  BookOpen,
  CalendarDays,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * TEACHER REVIEWS — ENHANCED SUBMISSION EVALUATION HUB (TRACK 3)
 *
 * Supports four instructor actions:
 * 1. Accept (approve)  → submission approved
 * 2. Request Revision  → written feedback required
 * 3. Reject            → rejection reason required
 * 4. Schedule Follow-up → creates meeting, sets Pending Follow-up
 */

function StatusBadge({ status }) {
  const config = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    revision_requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending_followup: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  const c = config[status?.toLowerCase()] || "bg-white/5 text-[var(--text-tertiary)] border-white/10";
  return (
    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border ${c}`}>
      {status?.replace(/_/g, " ") || "draft"}
    </span>
  );
}

function ReviewActionModal({ submission, onClose, onSubmit, t, program }) {
  const [action, setAction] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [followupTime, setFollowupTime] = useState("");
  const [followupDuration, setFollowupDuration] = useState(30);
  const [meetingLink, setMeetingLink] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    // Validate business rules
    if (action === "revision_requested" && !feedback.trim()) {
      setError(t("teacher.feedbackRequired"));
      return;
    }
    if (action === "rejected" && !rejectionReason.trim()) {
      setError(t("teacher.rejectionReasonRequired"));
      return;
    }
    if (action === "pending_followup" && !followupDate) {
      setError("Follow-up date is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body = {
        id: submission.id,
        status: action,
        feedback: feedback.trim() || null,
        rejection_reason: rejectionReason.trim() || null,
        review_action: action,
        followup_date: followupDate || null,
        followup_time: followupTime || null,
        followup_duration: followupDuration || 30,
        meeting_link: meetingLink.trim() || null,
        followup_notes: followupNotes.trim() || null,
      };

      const res = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onSubmit(submission.id);
      } else {
        setError(t((data.error || "Failed to process review action") || "") || (data.error || "Failed to process review action"));
      }
    } catch (e) {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
            {t("teacher.reviewActions")}
          </h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Submission Info */}
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-primary)]">
          <p className="text-[10px] font-bold text-[var(--text-primary)]">
            {submission.v2_deliverables?.title || "Untitled"}
          </p>
          <p className="text-[8px] text-[var(--text-secondary)] mt-1">
            {submission.v2_participants?.name || "Anonymous"} · Week{" "}
            {submission.v2_deliverables?.week_number || "?"}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setAction("approved"); setError(null); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
              action === "approved"
                ? "bg-emerald-500 text-white ring-2 ring-emerald-400"
                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> {t("teacher.approve")}
          </button>
          <button
            onClick={() => { setAction("revision_requested"); setError(null); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
              action === "revision_requested"
                ? "bg-blue-500 text-white ring-2 ring-blue-400"
                : "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("teacher.requestRevision")}
          </button>
          <button
            onClick={() => { setAction("rejected"); setError(null); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
              action === "rejected"
                ? "bg-rose-500 text-white ring-2 ring-rose-400"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" /> {t("teacher.reject")}
          </button>
          <button
            onClick={() => { setAction("pending_followup"); setError(null); }}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
              action === "pending_followup"
                ? "bg-purple-500 text-white ring-2 ring-purple-400"
                : "bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> {t("teacher.scheduleFollowup")}
          </button>
        </div>

        {/* Dynamic Form Fields */}
        {(action === "revision_requested" || action === "approved") && (
          <div className="space-y-2">
            <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
              {action === "revision_requested"
                ? t("teacher.feedbackPlaceholder")
                : "Feedback (optional)"}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
              placeholder={t("teacher.feedbackPlaceholder")}
            />
          </div>
        )}

        {action === "rejected" && (
          <div className="space-y-2">
            <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
              {t("teacher.rejectionReasonRequired")}
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
              placeholder={t("teacher.rejectionReasonPlaceholder")}
            />
          </div>
        )}

        {action === "pending_followup" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  Date
                </label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  Time
                </label>
                <input
                  type="time"
                  value={followupTime}
                  onChange={(e) => setFollowupTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  Duration (min)
                </label>
                <input
                  type="number"
                  value={followupDuration}
                  onChange={(e) => setFollowupDuration(Number(e.target.value))}
                  min={15}
                  max={120}
                  step={15}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                  Meeting Link
                </label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                Notes (optional)
              </label>
              <textarea
                value={followupNotes}
                onChange={(e) => setFollowupNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
                placeholder="What to discuss during the follow-up..."
              />
            </div>
          </div>
        )}

        {/* Evaluation Section based on grading_mode */}
        {action === "approved" && program && (
          <div className="space-y-2">
            <label className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
              {t("teacher.evaluation")}
            </label>
            {program.grading_mode === "academic" ? (
              <input
                type="number"
                placeholder="Score (0-100)"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                min={0}
                max={100}
              />
            ) : program.grading_mode === "incubation" ? (
              <div className="space-y-2">
                {["Idea", "Execution", "Market", "Team", "Traction"].map((dim) => (
                  <div key={dim} className="flex items-center gap-3">
                    <span className="text-[8px] font-bold text-[var(--text-secondary)] w-16">{dim}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className={`w-5 h-5 rounded text-[8px] font-black ${
                            star <= 3
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-white/5 text-[var(--text-tertiary)]"
                          }`}
                        >
                          {star}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p className="text-[9px] font-bold text-rose-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!action || submitting}
          className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:brightness-110 transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
          ) : (
            <><Send className="w-4 h-4" /> Submit Review</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function SubmissionsHub() {
  const [submissions, setSubmissions] = useState([]);
  const [programs, setPrograms] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reviewModal, setReviewModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [layoutRole, setLayoutRole] = useState("teacher");
  const { t } = useI18n();

  // Use the session role when available so internal staff assigned to a
  // program keep their staff identity instead of being labelled Teacher.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored.role) setLayoutRole(stored.role);
    } catch (_) {}
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const res = await fetch(
        `/api/teacher/full-state?cid=${user.cid || user.id}`,
      );
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.submissions || []);
        // Build program map for grading modes
        const progMap = {};
        for (const sub of data.submissions || []) {
          if (sub.program_id && !progMap[sub.program_id]) {
            try {
              const progRes = await fetch(`/api/programs?id=${sub.program_id}`);
              const progData = await progRes.json();
              if (progData.success && progData.programs?.[0]) {
                progMap[sub.program_id] = progData.programs[0];
              }
            } catch (_) {}
          }
        }
        setPrograms(progMap);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleReviewAction = (sub) => {
    setReviewModal(sub);
  };

  const handleReviewComplete = (submissionId) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setReviewModal(null);
  };

  const filtered = submissions.filter((s) => {
    // Search filter
    const matchesSearch =
      s.v2_deliverables?.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.v2_participants?.name?.toLowerCase().includes(search.toLowerCase());
    // Status filter
    const matchesStatus =
      statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <div className="space-y-10 text-left animate-in">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-secondary)] pb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("teacher.reviews")}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase italic">
              {t("teacher.reviews")}{" "}
              <span className="text-[var(--text-secondary)] opacity-40">
                Hub
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest outline-none focus:border-[var(--brand-orange)]/40 transition-all"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="pending_followup">Pending Follow-up</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            <div className="relative w-full lg:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="SEARCH..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl py-4 pl-12 pr-4 text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest outline-none focus:border-[var(--brand-orange)]/40 transition-all placeholder:opacity-30 shadow-sm"
              />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
              {t("common.loading")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            {filtered.map((sub) => (
              <div
                key={sub.id}
                className="ios-card bg-secondary border-[var(--border-secondary)] group hover:border-[var(--brand-orange)]/30 transition-all shadow-sm"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest pl-0.5 mb-1 opacity-60">
                        Deliverable
                      </p>
                      <h4 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tighter">
                        {sub.v2_deliverables?.title || "Unknown"}
                      </h4>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[8px] font-black text-[var(--brand-orange)] uppercase tracking-widest bg-[var(--brand-orange)]/10 px-3 py-1 rounded-full border border-[var(--brand-orange)]/20">
                      Week {sub.v2_deliverables?.week_number || "?"}
                    </span>
                    <StatusBadge status={sub.status} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-tertiary/30 border border-[var(--border-secondary)] mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1 opacity-60">
                        Submitter
                      </p>
                      <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tighter italic">
                        {sub.v2_participants?.name ||
                          sub.v2_groups?.name ||
                          "Anonymous"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.version_number > 0 && (
                        <span className="text-[7px] font-bold text-[var(--text-tertiary)] bg-white/5 px-2 py-1 rounded">
                          v{sub.version_number}
                        </span>
                      )}
                      {sub.file_url && (
                        <a
                          href={sub.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-secondary border border-[var(--border-secondary)] hover:bg-[var(--brand-orange)]/10 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all shadow-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  {sub.supporting_url && (
                    <div className="mt-2">
                      <a
                        href={sub.supporting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8px] font-bold text-[var(--brand-orange)] hover:underline"
                      >
                        Supporting URL ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Previous feedback if any */}
                {sub.feedback && (
                  <div className="mb-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">
                      Previous Feedback
                    </p>
                    <p className="text-[9px] text-[var(--text-primary)]">
                      {sub.feedback}
                    </p>
                  </div>
                )}

                {/* Review Actions — 4 buttons */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        const subWithFeedback = { ...sub };
                        setReviewModal(subWithFeedback);
                      }}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t("teacher.approve")}
                    </button>
                    <button
                      onClick={() => {
                        const subWithFeedback = { ...sub };
                        setReviewModal(subWithFeedback);
                      }}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> {t("teacher.requestRevision")}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        const subWithFeedback = { ...sub };
                        setReviewModal(subWithFeedback);
                      }}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-[9px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" /> {t("teacher.reject")}
                    </button>
                    <button
                      onClick={() => {
                        const subWithFeedback = { ...sub };
                        setReviewModal(subWithFeedback);
                      }}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 font-black text-[9px] uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all"
                    >
                      <CalendarDays className="w-3.5 h-3.5" /> {t("teacher.scheduleFollowup")}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full py-40 text-center border-2 border-dashed border-[var(--border-secondary)] rounded-[3rem]">
                <CheckCircle2 className="w-16 h-16 text-[var(--text-secondary)] mx-auto mb-6 opacity-20" />
                <p className="text-[var(--text-secondary)] font-black uppercase text-[10px] tracking-[0.3em] opacity-40">
                  {t("common.noResults")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Queue status */}
        <div className="fixed bottom-10 right-10 z-[200]">
          <div className="ios-card bg-secondary border-[var(--border-primary)] !p-6 shadow-2xl flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                Queue Status
              </span>
              <span className="text-xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">
                {submissions.length} Pending
              </span>
            </div>
            <div className="h-10 w-px bg-[var(--border-secondary)]" />
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                System Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review Action Modal */}
      {reviewModal && (
        <ReviewActionModal
          submission={reviewModal}
          program={programs[reviewModal.program_id]}
          onClose={() => setReviewModal(null)}
          onSubmit={handleReviewComplete}
          t={t}
        />
      )}
    </>
  );
}
