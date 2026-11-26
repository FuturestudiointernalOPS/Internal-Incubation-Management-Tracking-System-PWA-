import { useState, useEffect } from "react";
import { History, X, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "./helpers";

export default function SubmissionTimeline({ submission, onClose }) {
  const { t } = useI18n();
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setScoringData] = useState(null);

  const submissionData = submission.data || {};
  const scores = submissionData._scores;
  // Narrowed to a primitive so the effect below depends on "has inline scores"
  // rather than on the (re-created) object itself.
  const hasScores = Boolean(scores);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/platform/form-runs?timeline=${submission.id}`);
        const data = await response.json();
        if (data.success) setTimeline(data.timeline || []);
      } catch (_) {}

      // Fetch scoring breakdown if not already in submission data
      if (hasScores) {
        try {
          const scoringRes = await fetch(`/api/platform/form-runs?scoring=${submission.id}`);
          const scoringJson = await scoringRes.json();
          if (scoringJson.success) setScoringData(scoringJson);
        } catch (_) {}
      }
      setLoading(false);
    }
    load();
  }, [submission.id, hasScores]);

  const getScoreColor = (score) =>
    score >= 80 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" :
    score >= 60 ? "text-amber-500 bg-amber-500/10 border-amber-500/30" :
    "text-rose-500 bg-rose-500/10 border-rose-500/30";

  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-secondary overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-tertiary">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)] flex items-center gap-1.5"><History className="w-3 h-3 text-[var(--brand-orange)]" /> {t("platformMisc.runs.submissionHistory", { name: submission.submitter_name || submission.submitter_id })}</h4>
        <button onClick={onClose}><X className="w-3.5 h-3.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" /></button>
      </div>
      <div className="p-4 max-h-64 overflow-y-auto">
        {/* Scoring Breakdown */}
        {scores && (
          <div className="mb-4 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.assessmentScore")}</p>
              <div className="flex items-center gap-2">
                <span className={cn("text-[14px] font-black", scores.overall >= 80 ? "text-emerald-500" : scores.overall >= 60 ? "text-amber-500" : "text-rose-500")}>{scores.overall}%</span>
                {scores.ranking && (
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", getScoreColor(scores.overall))}>{scores.ranking}</span>
                )}
              </div>
            </div>

            {/* Section breakdown */}
            {scores.sections && Object.keys(scores.sections).length > 0 && (
              <div className="space-y-1.5">
                {Object.entries(scores.sections).map(([name, section]) => (
                  <div key={name} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[var(--text-primary)] font-bold truncate">{name}</span>
                      <span className="text-[var(--text-secondary)] text-[10px] font-medium">{t("platformMisc.runs.sectionRated", { count: section.count, weight: section.weight })}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Score bar */}
                      <div className="w-16 h-1.5 rounded-full bg-[var(--border-primary)] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", section.score >= 80 ? "bg-emerald-500" : section.score >= 60 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${Math.min(section.score, 100)}%` }} />
                      </div>
                      <span className={cn("text-[10px] font-black w-10 text-right", section.score >= 80 ? "text-emerald-500" : section.score >= 60 ? "text-amber-500" : "text-rose-500")}>{section.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-[var(--brand-orange)]" /> : timeline.length === 0 ? (
          <p className="text-[10px] font-medium text-[var(--text-secondary)] text-center py-4">{t("platformMisc.runs.noTimelineEntries")}</p>
        ) : (
          <div className="space-y-2">
            {timeline.map((entry, index) => {
              const dotColor =
                entry.action === "submitted" ? "bg-blue-500" :
                entry.action === "approved" ? "bg-emerald-500" :
                entry.action === "rejected" ? "bg-rose-500" :
                entry.action === "revision_requested" ? "bg-amber-500" :
                entry.action === "escalated" ? "bg-purple-500" :
                entry.action === "reassigned" ? "bg-indigo-500" :
                entry.action === "draft_saved" || entry.action === "started" ? "bg-slate-500" :
                "bg-[var(--brand-orange)]";
              return (
                <div key={index} className="flex items-start gap-2 text-[10px]">
                  <div className={cn("w-1.5 h-1.5 mt-1 rounded-full shrink-0", dotColor)} />
                  <div className="flex-1">
                    <span className="font-bold uppercase tracking-wide">{entry.action}</span>
                    {entry.actor_name && <span className="text-[var(--text-secondary)]"> {t("platformMisc.runs.by")} {entry.actor_name}</span>}
                    <span className="text-[var(--text-secondary)] ml-1">{new Date(entry.created_at).toLocaleString()}</span>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-0.5 text-[var(--text-secondary)]">
                        {typeof entry.metadata === "string" ? entry.metadata : Object.entries(entry.metadata).filter(([,value]) => value).map(([key, value]) => <span key={key} className="mr-2">{key}: {String(value).substring(0, 50)}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
