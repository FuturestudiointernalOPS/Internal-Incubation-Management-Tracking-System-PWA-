import { FileText } from "lucide-react";
import StatusBadge from "./StatusBadge";

export default function AssignmentsTab({ t, curriculum }) {
  return (
    <>
  <div className="space-y-4">
    {curriculum.weeks.filter((week) => !week.locked).map((week) => (
      <div key={week.number} className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          Week {week.number}
        </h3>
        {week.deliverables.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{t("participant.noAssignmentsThisWeek")}</p>
        ) : (
          week.deliverables.map((deliverable) => (
            <div
              key={deliverable.id}
              className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  deliverable.submission?.status === "approved" ? "bg-emerald-500/10" :
                  deliverable.submission ? "bg-amber-500/10" : "bg-white/5"
                }`}>
                  <FileText className={`w-4 h-4 ${
                    deliverable.submission?.status === "approved" ? "text-emerald-400" :
                    deliverable.submission ? "text-amber-400" : "text-[var(--text-tertiary)]"
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                    {deliverable.title}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {deliverable.allowedFormat} {deliverable.dueDate ? `· ${t("participant.due")}: ${new Date(deliverable.dueDate).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {deliverable.submission ? (
                  <StatusBadge status={deliverable.submission.status} />
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("participant.pending")}</span>
                )}
                {deliverable.submission?.score != null && (
                  <span className="text-[10px] font-bold text-[var(--brand-orange)]">
                    {deliverable.submission.score}/100
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    ))}
    {curriculum.weeks.filter((week) => !week.locked).length === 0 && (
      <div className="text-center py-12">
        <FileText className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)]">
          {t("participant.noAssignmentsYet")}
        </p>
      </div>
    )}
  </div>
    </>
  );
}
