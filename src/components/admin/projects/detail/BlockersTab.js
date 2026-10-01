import { Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export default function BlockersTab({ blockers,
  blockerFilter,
  onFilter,
  filteredBlockers,
  blockerStatusLabels, }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {/* Blocker filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          {
            id: "all",
            label: t("adminMisc.projectDetail.blockerFilterAll", {
              count: blockers.length,
            }),
          },
          {
            id: "active",
            label: t("adminMisc.projectDetail.blockerFilterActive", {
              count: blockers.filter((blocker) => blocker.status === "active")
                .length,
            }),
          },
          {
            id: "resolved",
            label: t("adminMisc.projectDetail.blockerFilterResolved", {
              count: blockers.filter((blocker) => blocker.status === "resolved")
                .length,
            }),
          },
        ].map((filterOption) => (
          <button
            key={filterOption.id}
            onClick={() => onFilter(filterOption.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              blockerFilter === filterOption.id
                ? "bg-[var(--brand-orange)] text-black"
                : "bg-tertiary text-slate-500 hover:text-[var(--text-primary)]"
            }`}
          >
            {filterOption.label}
          </button>
        ))}
      </div>

      {filteredBlockers.length === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
          <Shield className="w-12 h-12 mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">
            {t("adminMisc.projectDetail.noBlockers")}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("adminMisc.projectDetail.noBlockersHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBlockers.map((blocker) => (
            <div
              key={blocker.id}
              className={`card flex items-start gap-3 p-4 border-l-4 ${
                blocker.status === "active"
                  ? "border-l-rose-500"
                  : "border-l-emerald-500"
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  blocker.status === "active"
                    ? "bg-rose-500/10"
                    : "bg-emerald-500/10"
                }`}
              >
                <Shield
                  className={`w-4 h-4 ${
                    blocker.status === "active"
                      ? "text-rose-500"
                      : "text-emerald-500"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[11px] font-bold text-[var(--text-primary)]">
                    {blocker.title}
                  </p>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      blocker.status === "active"
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}
                  >
                    {blockerStatusLabels[blocker.status] ||
                      blocker.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] font-medium text-[var(--text-secondary)]">
                  {blocker.task_title && (
                    <span>
                      {t("adminMisc.projectDetail.taskLabel")}{" "}
                      <span className="font-bold text-[var(--text-secondary)]">
                        {blocker.task_title}
                      </span>
                    </span>
                  )}
                  {blocker.user_name && (
                    <span>
                      {t("adminMisc.projectDetail.by")}{" "}
                      <span className="font-bold">
                        {blocker.user_name}
                      </span>
                    </span>
                  )}
                  <span>
                    {new Date(blocker.created_at).toLocaleDateString()}
                  </span>
                  {blocker.severity && (
                    <span
                      className={`font-bold uppercase ${
                        blocker.severity === "high" ||
                        blocker.severity === "critical"
                          ? "text-rose-500"
                          : "text-slate-500"
                      }`}
                    >
                      {blocker.severity}
                    </span>
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
