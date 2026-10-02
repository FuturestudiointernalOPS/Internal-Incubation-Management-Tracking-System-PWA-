import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG, formatDate, statusLabelKey } from "./constants";

export default function SummaryAssignmentsCard({ summaryTasks, user }) {
  const { t } = useI18n();

  const assignedTasks = summaryTasks.filter(
    (task) =>
      task.user_id && user?.cid && String(task.user_id) !== String(user.cid),
  );
  if (assignedTasks.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
        <Users className="w-4 h-4 text-[var(--brand-orange)]" />
        {t("staff.section.taskAssignments")}
      </h3>
      <div className="space-y-2">
        {assignedTasks.map((task) => {
          const statusConfig =
            STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
          return (
            <div
              key={task.id}
              className="card p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] font-bold text-[var(--text-primary)]">
                  {task.title}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                  {t("staff.opReport.assignedBy")}{" "}
                  {task.user_name || t("common.unknown")} {t("time.on")}{" "}
                  {formatDate(task.created_at)}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
              >
                {t(statusLabelKey(task.status))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
