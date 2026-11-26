import { Shield, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function BlockerModal({
  blockerModal,
  newBlockerDescription,
  newBlockerNotes,
  newBlockerPriority,
  newBlockerRefUrl,
  newBlockerTitle,
  onAddBlocker,
  onClose,
  onDescriptionChange,
  onNotesChange,
  onPriorityChange,
  onRefUrlChange,
  onResolveBlocker,
  onTitleChange,
  taskRows,
  tasks,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md space-y-4 border-rose-500/30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-black uppercase tracking-wider text-rose-400">
              {t("staff.table.blockers")}
            </span>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[10px] text-[var(--text-secondary)]">
          {t("staff.table.task")}:{" "}
          <span className="font-bold text-[var(--text-primary)]">
            {blockerModal.type === "api"
              ? tasks.find((task) => task.id === blockerModal.taskId)?.title ||
                t("staff.table.task")
              : taskRows[blockerModal]?.name || t("common.untitled")}
          </span>
        </p>

        {/* Existing blockers */}
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {(() => {
            const blockers =
              blockerModal.type === "api"
                ? tasks.find((task) => task.id === blockerModal.taskId)
                    ?.blockers || []
                : taskRows[blockerModal]?.blockers || [];
            return blockers.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                {t("staff.opReport.noBlockersDeclared")}
              </p>
            ) : (
              blockers.map((blocker) => (
                <div
                  key={blocker.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    blocker.status === "Resolved"
                      ? "border border-emerald-500/30 bg-emerald-500/[0.08]"
                      : "border border-rose-500/30 bg-rose-500/[0.08]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                        {blocker.title || blocker.description}
                      </p>
                      <span className="text-[10px] font-bold uppercase text-rose-500/60 shrink-0">
                        {blocker.severity || "medium"}
                      </span>
                    </div>
                    {blocker.description &&
                      blocker.description !== blocker.title && (
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                          {blocker.description}
                        </p>
                      )}
                    {blocker.reference_url && (
                      <a
                        href={blocker.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 underline break-all"
                      >
                        {blocker.reference_url}
                      </a>
                    )}
                    {blocker.notes && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                        {blocker.notes}
                      </p>
                    )}
                    {blocker.resolved_at && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                        Resolved{" "}
                        {new Date(blocker.resolved_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {blocker.status?.toLowerCase() === "active" ? (
                    <button
                      onClick={() => onResolveBlocker(blocker)}
                      className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white transition-all shrink-0"
                    >
                      {t("staff.opReport.resolve")}
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 rounded-lg">
                      {t("staff.opReport.resolved")}
                    </span>
                  )}
                </div>
              ))
            );
          })()}
        </div>

        {/* Add new blocker — blocked if task is closed */}
        {(() => {
          const taskStatus =
            blockerModal.type === "api"
              ? tasks.find((task) => task.id === blockerModal.taskId)?.status
              : null;
          const closedStatuses = ["completed", "archived", "carried_over"];
          const isClosed = taskStatus && closedStatuses.includes(taskStatus);

          if (isClosed) {
            return (
              <p className="text-[10px] text-rose-400 text-center py-2">
                Cannot add blockers — this task is {taskStatus}.
              </p>
            );
          }

          return (
            <div className="space-y-2">
              <input
                type="text"
                value={newBlockerTitle}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={t("staff.opReport.blockerTitlePlaceholder")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all"
              />
              <textarea
                value={newBlockerDescription}
                onChange={(event) => onDescriptionChange(event.target.value)}
                placeholder={t("staff.opReport.blockerDescriptionPlaceholder")}
                rows={2}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
              />
              <div className="flex gap-2">
                <select
                  value={newBlockerPriority}
                  onChange={(event) => onPriorityChange(event.target.value)}
                  className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)]"
                >
                  <option value="low">{t("staff.opReport.priorityLow")}</option>
                  <option value="medium">
                    {t("staff.opReport.priorityMedium")}
                  </option>
                  <option value="high">
                    {t("staff.opReport.priorityHigh")}
                  </option>
                  <option value="critical">
                    {t("staff.opReport.priorityCritical")}
                  </option>
                </select>
                <input
                  type="url"
                  value={newBlockerRefUrl}
                  onChange={(event) => onRefUrlChange(event.target.value)}
                  placeholder={t(
                    "staff.opReport.blockerReferenceUrlPlaceholder",
                  )}
                  className="flex-[2] bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none text-[var(--text-primary)] focus:border-rose-500 transition-all"
                />
              </div>
              <textarea
                value={newBlockerNotes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder={t("staff.opReport.blockerNotesPlaceholder")}
                rows={2}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
              />
              <button
                onClick={onAddBlocker}
                disabled={!newBlockerTitle.trim()}
                className="w-full px-3 py-2 bg-rose-500 text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-30"
              >
                {t("staff.opReport.addBlockerButton")}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
