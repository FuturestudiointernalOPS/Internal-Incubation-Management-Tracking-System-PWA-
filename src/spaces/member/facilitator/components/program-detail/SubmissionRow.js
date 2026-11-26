"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  ExternalLink,
  MessageSquareText,
  RotateCcw,
  XCircle,
} from "lucide-react";

const MAX_FEEDBACK_HEIGHT = 240; // px — beyond this the box scrolls internally

/**
 * One submission, collapsible: the participant/deliverable header, the feedback
 * composer with an auto-growing textarea, and the decision buttons.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function SubmissionRow({ sub, onReview, t }) {
  const [feedback, setFeedback] = useState(sub.feedback || "");
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef(null);

  // Auto-grow the textarea with its content so long suggestions stay readable
  // instead of being trapped behind a fixed 2-row box.
  useEffect(() => {
    if (!expanded) return;
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    const overflows = element.scrollHeight > MAX_FEEDBACK_HEIGHT;
    element.style.height = `${overflows ? MAX_FEEDBACK_HEIGHT : element.scrollHeight}px`;
    element.style.overflowY = overflows ? "auto" : "hidden";
  }, [expanded, feedback]);

  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase truncate">
            {sub.participant_name || "Participant"}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
            {sub.deliverable_title || "Deliverable"}
          </p>
        </div>
        <span
          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
            sub.status === "approved"
              ? "bg-emerald-500/15 text-emerald-400"
              : sub.status === "revision_requested"
                ? "bg-amber-500/15 text-amber-400"
                : sub.status === "rejected"
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-slate-500/15 text-[var(--text-secondary)]"
          }`}
        >
          {sub.status}
        </span>
      </button>
      {expanded && (
        <div className="space-y-2.5 pt-2">
          {/* Feedback composer */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-primary p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor={`submission-feedback-${sub.id}`}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] cursor-pointer"
              >
                <MessageSquareText className="w-3 h-3 text-[var(--brand-orange)] shrink-0" />
                {t("pmMisc.submissions.feedbackLabel")}
              </label>
              {sub.file_url && (
                <a
                  href={sub.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:underline shrink-0"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {t("pmMisc.submissions.viewSubmissionFile")}
                </a>
              )}
            </div>
            <textarea
              id={`submission-feedback-${sub.id}`}
              ref={textareaRef}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={3}
              placeholder={t("pmMisc.submissions.feedbackPlaceholder")}
              className="w-full resize-none overflow-hidden bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[11px] font-medium leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] placeholder:font-normal outline-none focus:border-[var(--brand-orange)] transition-colors"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                {t("pmMisc.submissions.feedbackHint")}
              </p>
              {feedback.length > 0 && (
                <span className="text-[10px] font-bold tabular-nums text-[var(--text-tertiary)] shrink-0">
                  {t("pmMisc.submissions.charCount", { count: feedback.length })}
                </span>
              )}
            </div>
          </div>

          {/* Decision actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onReview(sub.id, "approved", feedback)}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" />
              {t("pmMisc.submissions.approve")}
            </button>
            <button
              onClick={() => onReview(sub.id, "revision_requested", feedback)}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {t("pmMisc.submissions.requestRevision")}
            </button>
            <button
              onClick={() => onReview(sub.id, "rejected", feedback)}
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-colors"
            >
              <XCircle className="w-3 h-3" />
              {t("pmMisc.submissions.reject")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
