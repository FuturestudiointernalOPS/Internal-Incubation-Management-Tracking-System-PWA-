"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  X,
  Shield,
  User,
  Calendar,
  ChevronDown,
  Briefcase,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

function StatusBadge({ status }) {
  const config = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    revision_requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const c =
    config[status?.toLowerCase()] ||
    "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${c}`}
    >
      {status?.replace(/_/g, " ") || "draft"}
    </span>
  );
}

export default function PMSubmissions() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProgram, setFilterProgram] = useState("all");
  const [search, setSearch] = useState("");
  const [reviewModal, setReviewModal] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const fetchSubmissions = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    setLoading(true);
    try {
      const pmId = user.cid || user.id;
      const res = await fetch(
        `/api/pm/submissions?assigned_pm_id=${encodeURIComponent(pmId)}`,
      );
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.submissions || []);
        setPrograms(data.programs || []);
      }
    } catch (e) {
      console.error("Failed to fetch submissions", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleReview = async (submissionId, newStatus) => {
    setActionLoading(true);
    try {
      await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: submissionId,
          status: newStatus,
          feedback: feedback.trim() || null,
        }),
      });
      setReviewModal(null);
      setFeedback("");
      fetchSubmissions();
    } catch (e) {
      console.error("Review failed", e);
    }
    setActionLoading(false);
  };

  const filtered = submissions.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterProgram !== "all" && s.program_id !== filterProgram) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        s.deliverable_title?.toLowerCase().includes(q) ||
        s.participant_name?.toLowerCase().includes(q) ||
        s.participant_id?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  return (
    <DashboardLayout role="program_manager" activeTab="submissions">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Reviews & Grading
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Submissions
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {submissions.length} total · {pendingCount} pending review
            </p>
          </div>
          <button
            onClick={fetchSubmissions}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by participant or deliverable..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
                ? "No matches"
                : "No submissions yet"}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {search || filterStatus !== "all"
                ? "Try different filters"
                : "Submissions from participants will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((sub) => (
              <div
                key={sub.id}
                className={`ios-card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all ${
                  sub.status === "pending"
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
                            sub.participant_name ||
                            sub.participant_id ||
                            "?"
                          ).charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {sub.participant_name ||
                              sub.participant_id ||
                              "Unknown"}
                          </p>
                          <p className="text-[8px] text-slate-500 uppercase tracking-wider">
                            {sub.participant_group || sub.participant_id
                              ? `Group: ${sub.participant_group || "—"}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={sub.status} />
                    </div>
                    <p className="text-[8px] text-slate-500 mt-3">
                      Submitted{" "}
                      {sub.created_at
                        ? new Date(sub.created_at).toLocaleDateString()
                        : ""}
                    </p>
                  </div>

                  {/* Submission Details */}
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                        {sub.deliverable_title ||
                          `Deliverable #${sub.deliverable_id}`}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />{" "}
                          {sub.program_name || `Program #${sub.program_id}`}
                        </span>
                        {sub.deliverable_week && (
                          <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Week{" "}
                            {sub.deliverable_week}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--border-primary)]">
                      {sub.file_url && (
                        <a
                          href={sub.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" /> View File
                        </a>
                      )}
                      {sub.status === "pending" &&
                        sub.grading_mode !== "followup" && (
                          <button
                            onClick={() => setReviewModal(sub)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all ml-auto"
                          >
                            <Shield className="w-3 h-3" />{" "}
                            {sub.grading_mode === "review"
                              ? "Feedback"
                              : "Review"}
                          </button>
                        )}
                      {sub.status === "pending" &&
                        sub.grading_mode === "followup" && (
                          <button
                            onClick={() => setScheduleModal(sub)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all ml-auto"
                          >
                            <Calendar className="w-3 h-3" /> Schedule Review
                          </button>
                        )}
                      {sub.status !== "pending" && (
                        <span className="text-[8px] text-slate-500 italic ml-auto">
                          Reviewed{" "}
                          {sub.reviewed_at
                            ? new Date(sub.reviewed_at).toLocaleDateString()
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
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
                <h3 className="text-sm font-black uppercase tracking-tight">
                  Review Submission
                </h3>
              </div>
              <button onClick={() => setReviewModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Participant
                </p>
                <p className="text-sm font-bold mt-0.5">
                  {reviewModal.participant_name || reviewModal.participant_id}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Deliverable
                </p>
                <p className="text-sm font-bold mt-0.5">
                  {reviewModal.deliverable_title ||
                    `Deliverable #${reviewModal.deliverable_id}`}
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
                    View Submission File
                  </span>
                </a>
              )}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Feedback
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="Provide feedback to the participant..."
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleReview(reviewModal.id, "approved")}
                disabled={actionLoading}
                className="flex-1 py-3 bg-emerald-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() =>
                  handleReview(reviewModal.id, "revision_requested")
                }
                disabled={actionLoading}
                className="flex-1 py-3 bg-blue-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Request Revision
              </button>
              <button
                onClick={() => handleReview(reviewModal.id, "rejected")}
                disabled={actionLoading}
                className="flex-1 py-3 bg-rose-500 text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
