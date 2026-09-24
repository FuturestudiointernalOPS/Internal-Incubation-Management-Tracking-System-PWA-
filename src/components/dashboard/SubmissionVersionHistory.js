"use client";

import React, { useState } from "react";
import {
  FileText,
  ExternalLink,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Send,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { getServerErrorKey } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";

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
  const { t } = useI18n();
  const config = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    revision_requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending_followup: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  const classes =
    config[status?.toLowerCase()] ||
    "bg-white/5 text-[var(--text-tertiary)] border-white/10";
  const raw = status || "draft";
  const statusKey = `status.${raw}`;
  let label = t(statusKey);
  if (label === statusKey) {
    const participantKey = `participant.${raw}`;
    label = t(participantKey);
    if (label === participantKey) label = raw.replace(/_/g, " ");
  }
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${classes}`}
    >
      {label}
    </span>
  );
}

function VersionTimeline({ versions }) {
  const { t } = useI18n();
  const [expandedVersion, setExpandedVersion] = useState(null);

  if (!versions || versions.length === 0) return null;

  return (
    <div className="relative pl-6 space-y-4">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-[var(--border-primary)]" />

      {versions.map((version, index) => (
        <div key={version.id} className="relative">
          {/* Timeline dot */}
          <div
            className={`absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
              version.status === "approved"
                ? "bg-emerald-500 border-emerald-400"
                : version.status === "rejected"
                  ? "bg-rose-500 border-rose-400"
                  : version.status === "revision_requested"
                    ? "bg-blue-500 border-blue-400"
                    : version.status === "pending_followup"
                      ? "bg-purple-500 border-purple-400"
                      : "bg-amber-500 border-amber-400"
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>

          {/* Version card */}
          <div
            className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg p-3 cursor-pointer hover:border-brand-orange/30 transition-all"
            onClick={() =>
              setExpandedVersion(
                expandedVersion === version.id ? null : version.id,
              )
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-[var(--brand-orange)]">
                  v{version.version_number || index + 1}
                </span>
                <StatusBadge status={version.status} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {version.created_at
                    ? new Date(version.created_at).toLocaleDateString()
                    : ""}
                  {version.created_at &&
                    ` ${new Date(version.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </span>
                {expandedVersion === version.id ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                )}
              </div>
            </div>

            {/* Expanded details */}
            <AnimatePresence>
              {expandedVersion === version.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 pt-3 border-t border-[var(--border-primary)] space-y-3 overflow-hidden"
                >
                  {/* Files */}
                  <div className="flex flex-wrap gap-2">
                    {version.file_url && (
                      <a
                        href={version.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] hover:border-brand-orange/30 transition-all"
                      >
                        <FileText className="w-3 h-3 text-[var(--brand-orange)]" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)]">
                          {t("participant.viewFile")}
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />
                      </a>
                    )}
                    {version.supporting_url && (
                      <a
                        href={version.supporting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] hover:border-brand-orange/30 transition-all"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400">
                          {t("participant.supportingUrl")}
                        </span>
                      </a>
                    )}
                  </div>

                  {/* Feedback */}
                  {version.feedback && (
                    <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageSquare className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                          {t("participant.feedback")}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                        {version.feedback}
                      </p>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {version.rejection_reason && (
                    <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
                          {t("participant.rejectionReason")}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                        {version.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Review Action */}
                  {version.review_action && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("participant.action")}:
                      </span>
                      <StatusBadge status={version.review_action} />
                    </div>
                  )}

                  {/* Score */}
                  {version.evaluation_score > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("participant.score")}:
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          version.evaluation_score >= 70
                            ? "text-emerald-400"
                            : version.evaluation_score >= 40
                              ? "text-amber-400"
                              : "text-rose-400"
                        }`}
                      >
                        {version.evaluation_score}/100
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

// Stable shape: the hook keys its internal work on this, so it is made once here
// rather than rebuilt on every render. A refusal carries its own message, which
// is kept in the value so the screen can tell "nothing yet" from "the read failed".
const EMPTY_HISTORY = { grouped: [], failed: false, failure: null };

const pickHistory = (payload) =>
  payload?.success
    ? { grouped: payload.grouped || [], failed: false, failure: null }
    : { grouped: [], failed: true, failure: payload?.error || null };

export default function SubmissionVersionHistory({
  participantId,
  programId,
  deliverableId,
  compact,
}) {
  const { t } = useI18n();
  const [expandedDeliverable, setExpandedDeliverable] = useState(null);

  // The history is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the screen keeps
  // no copy of its own and reads during render.
  let url = null;
  if (participantId) {
    url = `/api/submissions?participant_id=${participantId}&include_versions=true`;
    if (programId) url += `&program_id=${programId}`;
    if (deliverableId) {
      url += `&deliverable_id=${deliverableId}`;
      url += `&document_id=${deliverableId}`; // Track 2 compat
    }
  }

  const {
    data: history,
    loading: readLoading,
    error: readError,
    refresh,
  } = useApi(url, { defaultValue: EMPTY_HISTORY, transform: pickHistory });

  const groupedData = history.grouped;
  // The identity is absent for the first moment of a cold load, so the screen
  // keeps its placeholder rather than claiming there is nothing to show.
  const loading = !participantId || readLoading;

  // The three shapes of failure reach the screen as one message: what the server
  // refused with, and a request that never got an answer.
  let error = null;
  if (history.failed) {
    const key = getServerErrorKey(history.failure);
    error = key ? t(key) : history.failure || t("participant.failedToLoad");
  } else if (readError) {
    error = t("errors.networkError");
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(2)].map((_, index) => (
          <div
            key={index}
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
        <p className="text-[10px] font-bold text-rose-400">{error}</p>
        <button
          onClick={refresh}
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
        <p className="text-sm text-[var(--text-secondary)]">
          {t("participant.noSubmissionsYet")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center gap-2">
          <Send className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("participant.submissionHistory")} ({groupedData.length} {t("participant.deliverables").toLowerCase()})
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
                <span className="text-[11px] font-bold text-[var(--text-primary)]">
                  {group.deliverable_title || t("participant.deliverableNumber", { id: group.deliverable_id })}
                </span>
                {group.deliverable_due_date && (
                  <span
                    className={`text-[10px] font-bold ${
                      new Date(group.deliverable_due_date) < new Date()
                        ? "text-rose-400"
                        : "text-amber-400"
                    }`}
                  >
                    {t("participant.due")}: {new Date(group.deliverable_due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {group.versions.length > 1
                    ? t("participant.versionCountPlural", { count: group.versions.length })
                    : t("participant.versionCount", { count: group.versions.length })}
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
