import { Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function TaskCreationModal({
  assignedProjects,
  creatingTask,
  newTaskForm,
  onClose,
  onCreate,
  onFieldChange,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-secondary border border-[var(--border-primary)] rounded-xl p-6 space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--brand-orange)]" />
            <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
              {t("staff.opReport.newTask")}
            </span>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={newTaskForm.name}
            onChange={(event) => onFieldChange("name", event.target.value)}
            placeholder={t("staff.opReport.taskNamePlaceholder")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            autoFocus
          />
          <select
            value={newTaskForm.project_id}
            onChange={(event) =>
              onFieldChange("project_id", event.target.value)
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="">{t("common.none")}</option>
            {(assignedProjects || []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={newTaskForm.start_date}
              onChange={(event) => {
                const val = event.target.value;
                onFieldChange("start_date", val);
                if (newTaskForm.due_date && val && newTaskForm.due_date < val) {
                  onFieldChange("due_date", val);
                }
              }}
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none"
            />
            <input
              type="date"
              value={newTaskForm.due_date}
              min={newTaskForm.start_date || undefined}
              onChange={(event) =>
                onFieldChange("due_date", event.target.value)
              }
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--text-primary)] outline-none"
            />
          </div>
          <button
            onClick={onCreate}
            disabled={!newTaskForm.name.trim() || creatingTask}
            className="w-full px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide disabled:opacity-40 hover:brightness-110 transition-all"
          >
            {creatingTask ? t("common.saving") : t("reports.addTask")}
          </button>
        </div>
      </div>
    </div>
  );
}
