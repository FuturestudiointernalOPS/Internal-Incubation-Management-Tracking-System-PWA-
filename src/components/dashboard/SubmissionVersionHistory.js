"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Send,
  Eye,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * SUBMISSION VERSION HISTORY
 *
 * Displays a timeline of all submissions for a given participant+deliverable.
 * Each version shows:
 * - Version number
 * - Submission date
 * - Status
 * - File URL
 * - Supporting URL
 * - Feedback from instructor
 * - Review action
 *
 * Props:
 *   participantId: string
 *   programId: string
 *   deliverableId: string|null (optional - if null, shows all)
 *   compact: boolean (default false)
 */

function StatusBadge({ status }) {
  const config = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    revision_requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending_followup: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  const c =
    config[status?.toLowerCase()] ||
    "bg-white/5 text-[var(--text-tertiary)] border-white/10";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border ${c}`}
    >
      {status?.replace(/_/g, " ") || "draft"}
    </span>
  );
}

function VersionTimeline({ versions, onRefresh }) {
  const [expandedVersion, setExpandedVersion] = useState(null);

  if (!versions || versions.length === 0) return null;

  return (
    <div className="relative pl-6 space-y-4">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-[var(--border-primary)]" />

      {versions.map((ver, idx) => (
        <div key={ver.id} className="relative">
          {/* Timeline dot */}
          <div
            className={`absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
              ver.status === "approved"
                ? "bg-emerald-500 border-emerald-400"
                : ver.status === "rejected"
                  ? "bg-rose-500 border-rose-400"
                  : ver.status === "revision_requested"
                    ? "bg-blue-500 border-blue-400"
                    : ver.status === "pending_followup"
                      ? "bg-purple-500 border-purple-400"
                      : "bg-amber-500 border-amber-400"
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>

          {/* Version card */}
          <div
            className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg p-3 cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all"
            onClick={() =>
              setExpandedVersion(
                expandedVersion === ver.id ? null : ver.id,
              )
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-[var(--brand-orange)]">
                  v{ver.version_number || idx + 1}
                </span>
                <StatusBadge status={ver.status} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[8px] text-[var(--text-tertiary)]">
                  {ver.created_at
                    ? new Date(ver.created_at).toLocaleDateString()
                    : ""}
                  {ver.created_at &&
                    ` ${new Date(ver.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </span>
                {expandedVersion === ver.id ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                )}
              </div>
            </div>

            {/* Expanded details */}
            <AnimatePresence>
              {expandedVersion === ver.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 pt-3 border-t border-[var(--border-primary)] space-y-3 overflow-hidden"
                >
                  {/* Files */}
                  <div className="flex flex-wrap gap-2">
                    {ver.file_url && (
                      <a
                        href={ver.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all"
                      >
                        <FileText className="w-3 h-3 text-[var(--brand-orange)]" />
                        <span className="text-[8px] font-bold text-[var(--brand-orange)]">
                          View File
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />
                      </a>
                    )}
                    {ver.supporting_url && (
                      <a
                        href={ver.supporting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                        <span className="text-[8px] font-bold text-blue-400">
                          Supporting URL
                        </span>
                      </a>
                    )}
                  </div>

                  {/* Feedback */}
                  {ver.feedback && (
                    <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageSquare className="w-3 h-3 text-blue-400" />
                        <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">
                          Feedback
                        </span>
                      </div>
                      <p className="text-[9px] text-[var(--text-primary)] leading-relaxed">
                        {ver.feedback}
                      </p>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {ver.rejection_reason && (
                    <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">
                          Rejection Reason
                        </span>
                      </div>
                      <p className="text-[9px] text-[var(--text-primary)] leading-relaxed">
                        {ver.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Review Action */}
                  {ver.review_action && (
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                        Action:
                      </span>
                      <StatusBadge status={ver.review_action} />
                    </div>
                  )}

                  {/* Score */}
                  {ver.evaluation_score > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                        Score:
                      </span>
                      <span
                        className={`text-[10px] font-black ${
                          ver.evaluation_score >= 70
                            ? "text-emerald-400"
                            : ver.evaluation_score >= 40
                              ? "text-amber-400"
                              : "text-rose-400"
                        }`}
                      >
                        {ver.evaluation_score}/100
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SubmissionVersionHistory({
  participantId,
  programId,
  deliverableId,
  compact,
}) {
  const [groupedData, setGroupedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDeliverable, setExpandedDeliverable] = useState(null);

  const fetchVersions = useCallback(async () => {
    if (!participantId) return;
    setLoading(true);
    setError(null);
    try {
      let url = `/api/submissions?participant_id=${participantId}&include_versions=true`;
      if (programId) url += `&program_id=${programId}`;
      if (deliverableId) {
        url += `&deliverable_id=${deliverableId}`;
        url += `&document_id=${deliverableId}`; // Track 2 compat
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setGroupedData(data.grouped || []);
      } else {
        setError(data.error || "Failed to load version history");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [participantId, programId, deliverableId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-rose-500/5 border border-rose-500/10">
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        <p className="text-[9px] font-bold text-rose-400">{error}</p>
        <button
          onClick={fetchVersions}
          className="ml-auto p-1.5 rounded-lg hover:bg-rose-500/10"
        >
          <RefreshCw className="w-3 h-3 text-rose-400" />
        </button>
      </div>
    );
  }

  if (groupedData.length === 0) {
    if (compact) return null;
    return (
      <div className="text-center py-8">
        <FileText className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
        <p className="text-[9px] font-bold text-[var(--text-secondary)]">
          No submissions yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center gap-2">
          <Send className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
            Submission History ({groupedData.length} deliverables)
          </span>
        </div>
      )}

      {groupedData.map((group) => (
        <div key={group.deliverable_id} className="space-y-2">
          {/* Deliverable header */}
          {!compact && (
            <div
              className="flex items-center justify-between cursor-pointer py-1"
              onClick={() =>
                setExpandedDeliverable(
                  expandedDeliverable === group.deliverable_id
                    ? null
                    : group.deliverable_id,
                )
              }
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span className="text-[10px] font-bold text-[var(--text-primary)]">
                  {group.deliverable_title || `Deliverable #${group.deliverable_id}`}
                </span>
                {group.deliverable_due_date && (
                  <span
                    className={`text-[7px] font-bold ${
                      new Date(group.deliverable_due_date) < new Date()
                        ? "text-rose-400"
                        : "text-amber-400"
                    }`}
                  >
                    Due: {new Date(group.deliverable_due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-[var(--text-tertiary)]">
                  {group.versions.length} version{group.versions.length > 1 ? "s" : ""}
                </span>
                <StatusBadge status={group.latest?.status} />
              </div>
            </div>
          )}

          {/* Version timeline */}
          {(expandedDeliverable === group.deliverable_id || compact) && (
            <VersionTimeline versions={group.versions} />
          )}
        </div>
      ))}
    </div>
  );
}
