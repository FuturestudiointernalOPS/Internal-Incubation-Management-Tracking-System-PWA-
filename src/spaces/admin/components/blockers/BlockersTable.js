import { Shield, ListTodo } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { formatSeverity, getSeverityBg, getSeverityColor } from "./severity";

export default function BlockersTable({
  loading,
  filteredBlockers,
  onView,
  onOpenTasks,
  getTaskTitle,
}) {
  const { t } = useI18n();
  return (
    <>
      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredBlockers.length === 0 ? (
        <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
          <Shield className="w-16 h-16 mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">
            {t("reports.noBlockersFound")}
          </p>
          <p
            className="text-sm mt-2"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("adminMisc.blockers.emptyStateHint")}
          </p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th
                    className="text-left p-4 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("adminMisc.blockers.colBlocker")}
                  </th>
                  <th
                    className="text-left p-4 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("adminMisc.blockers.owner")}
                  </th>
                  <th
                    className="text-left p-4 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("adminMisc.blockers.linkedTask")}
                  </th>
                  <th
                    className="text-center p-4 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("adminMisc.blockers.severity")}
                  </th>
                  <th
                    className="text-center p-4 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("adminMisc.blockers.status")}
                  </th>
                  <th
                    className="text-center p-4 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("time.created")}
                  </th>
                  <th
                    className="text-center p-4 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("time.updated")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBlockers.map((blocker) => (
                  <tr
                    key={blocker.id}
                    className={`border-b border-divider/50 hover:bg-white/5 transition-colors ${
                      blocker.status === "active"
                        ? "bg-rose-500/5"
                        : "opacity-60"
                    }`}
                  >
                    <td className="p-4">
                      <button
                        onClick={() => onView(blocker)}
                        className="text-left group"
                      >
                        <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide group-hover:text-[var(--brand-orange)] transition-colors">
                          {blocker.title}
                        </p>
                        {blocker.description && (
                          <p
                            className="text-[10px] font-medium mt-0.5 line-clamp-1"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {blocker.description}
                          </p>
                        )}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                          {blocker.user_name?.charAt(0) || "?"}
                        </div>
                        <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                          {blocker.user_name || blocker.user_id || t("adminMisc.blockers.unknown")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={onOpenTasks}
                        className="text-[10px] font-bold hover:underline flex items-center gap-1"
                        style={{ color: "var(--chart-info)" }}
                      >
                        <ListTodo className="w-3 h-3" />
                        {getTaskTitle(blocker.task_id)}
                      </button>
                    </td>
                    <td className="text-center p-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getSeverityBg(blocker.severity)} ${getSeverityColor(blocker.severity)}`}
                      >
                        {formatSeverity(blocker.severity, t)}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                          blocker.status === "active"
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-emerald-500/10 text-emerald-500"
                        }`}
                      >
                        {blocker.status === "active"
                          ? t("status.active")
                          : t("status.resolved")}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {new Date(blocker.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {blocker.resolved_at
                          ? new Date(blocker.resolved_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
