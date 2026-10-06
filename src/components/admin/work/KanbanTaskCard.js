import { Trash2, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function KanbanTaskCard({
  task,
  isSuperAdmin,
  deletingTaskId,
  onDelete,
  onDragStart,
  onDragEnd,
}) {
  const { t } = useI18n();
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, task.id)}
      onDragEnd={onDragEnd}
      className={`p-2 rounded-lg border border-[var(--border-primary)] bg-tertiary/50 cursor-grab active:cursor-grabbing hover:border-brand-orange/30 transition-colors ${
        task.status === "completed" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`text-[10px] font-bold flex-1 truncate ${
            task.status === "completed"
              ? "line-through text-[var(--text-secondary)]"
              : "text-[var(--text-primary)]"
          }`}
        >
          {task.title}
        </span>
        {isSuperAdmin && (
          <button
            onClick={() => onDelete(task.id)}
            disabled={deletingTaskId === task.id}
            className="p-0.5 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors shrink-0"
            title={t("adminMisc.work.deleteTask")}
          >
            {deletingTaskId === task.id ? (
              <div className="w-2.5 h-2.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-2.5 h-2.5" />
            )}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {task.user_name && (
          <span className="text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-0.5">
            <User className="w-2 h-2" />
            {task.user_name}
          </span>
        )}
      </div>
    </div>
  );
}
