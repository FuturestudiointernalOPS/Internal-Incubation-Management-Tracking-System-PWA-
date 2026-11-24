"use client";

import { useI18n } from "@/lib/i18n";

/**
 * One line at the top of the Journey tab: how many of the journey's closing
 * reports are written, and which journeys still owe one.
 *
 * It is a summary, not a workspace: the report composer stays in the journey it
 * belongs to, where it is opened by the person writing it. This exists so the
 * question "what am I still owed?" is answered without opening every journey.
 *
 * Reads nothing: both values arrive from the panel's existing loads.
 */
export default function JourneyReportsSummary({ stages = [], reportsByStage = {} }) {
  const { t } = useI18n();

  const liveStages = stages.filter((stage) => !stage.is_archived);
  if (liveStages.length === 0) return null;

  const hasClosing = (stage) =>
    (reportsByStage[String(stage.id)] || []).some((report) => report.report_kind === "closing");

  const written = liveStages.filter(hasClosing);
  const missing = liveStages.filter((stage) => !hasClosing(stage));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] px-3 py-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
        {t("venture.manager.report.title")}
      </span>
      <span className="text-[11px] font-bold text-[var(--text-primary)]">
        {written.length} / {liveStages.length}
      </span>
      {missing.length > 0 && (
        <span className="min-w-0 truncate text-[10px] text-[var(--text-secondary)]">
          {t("venture.manager.closingReport")}: {missing.map((stage) => stage.name).join(" · ")}
        </span>
      )}
    </div>
  );
}
