import { AlertTriangle, Clock, Send, Target, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import TaskManager from "@/components/tasks/TaskManager";

export default function StandupDraftModal({
  assignedProjects,
  draftAvailable,
  isHistorical,
  newTaskRequest,
  onClose,
  onDiscardDraft,
  onRestoreDraft,
  onSubmit,
  readOnly,
  refreshTasks,
  saving,
  tasks,
  user,
  weekInfo,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-secondary border border-[var(--border-primary)] rounded-2xl shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-primary border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {t("staff.opReport.standupWeek")} {weekInfo.week}
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {weekInfo.year}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-tertiary rounded-md transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {isHistorical && (
            <div className="px-4 py-3 rounded-lg border border-amber-500/30 bg-[var(--bg-tertiary)] text-[12px] text-[var(--text-primary)] leading-relaxed flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>{t("staff.opReport.lockedWeek")}</span>
            </div>
          )}
          {/* Draft Recovery Banner */}
          {draftAvailable && !isHistorical && (
            <div className="px-4 py-3 rounded-lg border border-brand-orange/40 bg-brand-orange/10 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-[var(--brand-orange)]" />
                <span className="text-[12px] text-[var(--text-primary)] leading-relaxed font-medium">
                  {t("staff.opReport.draftPrompt")}
                </span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={onDiscardDraft}
                  className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-tertiary)] hover:text-[var(--text-primary)] border border-slate-600 rounded-lg hover:border-slate-400 transition-all"
                >
                  {t("staff.opReport.discard")}
                </button>
                <button
                  onClick={onRestoreDraft}
                  className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--brand-orange)] text-black rounded-lg hover:brightness-110 transition-all"
                >
                  {t("staff.opReport.restoreDraft")}
                </button>
              </div>
            </div>
          )}
          {/* Section 2 — Weekly Focus */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />{" "}
              {t("staff.opReport.weeklyFocus")}
            </h3>
            <TaskManager
              mode="standup"
              userId={user?.cid || user?.id}
              userName={user?.name || ""}
              projects={assignedProjects}
              taskList={tasks}
              onTasksChange={refreshTasks}
              weekInfo={weekInfo}
              showCarryOver={true}
              readOnly={readOnly || isHistorical}
              requestNewTask={newTaskRequest}
            />
          </div>
        </div>

        {/* Action Buttons */}
        {!readOnly && !isHistorical && (
          <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)] sticky bottom-0 bg-primary px-6 py-4">
            <button
              onClick={onSubmit}
              disabled={saving}
              className="flex-1 btn btn-primary gap-2 py-4"
            >
              <Send className="w-4 h-4" />
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
