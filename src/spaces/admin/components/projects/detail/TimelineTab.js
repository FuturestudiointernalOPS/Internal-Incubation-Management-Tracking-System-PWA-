import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export default function TimelineTab({ timeline, }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {timeline.length === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
          <Clock className="w-12 h-12 mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">
            {t("adminMisc.projectDetail.noActivity")}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("adminMisc.projectDetail.noActivityHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {timeline.map((entry, index) => (
            <div key={entry.id || index} className="flex items-start gap-3">
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    entry.action_type?.includes("COMPLETED")
                      ? "border-emerald-500 bg-emerald-500/20"
                      : entry.action_type?.includes("BLOCKED")
                        ? "border-rose-500 bg-rose-500/20"
                        : entry.action_type?.includes("CREATED")
                          ? "border-blue-500 bg-blue-500/20"
                          : entry.action_type?.includes("ASSIGNED")
                            ? "border-amber-500 bg-amber-500/20"
                            : "border-slate-500 bg-slate-500/20"
                  }`}
                />
                {index < timeline.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--border-primary)] min-h-[24px]" />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="card p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-widest ${
                        entry.action_type?.includes("COMPLETED")
                          ? "text-emerald-500"
                          : entry.action_type?.includes("BLOCKED")
                            ? "text-rose-500"
                            : entry.action_type?.includes("CREATED")
                              ? "text-blue-500"
                              : entry.action_type?.includes("ASSIGNED")
                                ? "text-amber-500"
                                : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {entry.action_type?.replace(/_/g, " ") ||
                        entry.action ||
                        t("adminMisc.projectDetail.update")}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {new Date(entry.created_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </span>
                  </div>
                  {(entry.task_title || entry.description) && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      {entry.description || entry.task_title}
                    </p>
                  )}
                  {entry.actor_name && (
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                      {t("adminMisc.projectDetail.by")}{" "}
                      <span className="font-bold text-[var(--text-primary)]">
                        {entry.actor_name}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
