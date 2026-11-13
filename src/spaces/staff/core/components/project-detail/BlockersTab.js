"use client";

import { Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BLOCKER_STATUS_LABELS } from "./constants";

/**
 * The blockers tab: the all/active/resolved filter chips and the blocker list.
 * Extracted verbatim from StaffProjectDetail.
 */
export default function BlockersTab({
  blockers,
  blockerFilter,
  onFilterChange,
}) {
  const { t } = useI18n();
  const filteredBlockers =
    blockerFilter === "all"
      ? blockers
      : blockers.filter((blocker) => blocker.status === blockerFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          {
            id: "all",
            label: t("staffMisc.projectDetail.blockerFilterAll", {
              count: blockers.length,
            }),
          },
          {
            id: "active",
            label: t("staffMisc.projectDetail.blockerFilterActive", {
              count: blockers.filter((blocker) => blocker.status === "active").length,
            }),
          },
          {
            id: "resolved",
            label: t("staffMisc.projectDetail.blockerFilterResolved", {
              count: blockers.filter((blocker) => blocker.status === "resolved").length,
            }),
          },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${blockerFilter === filter.id ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {filteredBlockers.length === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50">
          <Shield className="w-12 h-12 mb-3" />
          <p className="text-[10px] font-bold uppercase tracking-widest">
            {t("staffMisc.projectDetail.noBlockers")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBlockers.map((blocker) => (
            <div
              key={blocker.id}
              className={`card flex items-start gap-3 p-4 border-l-4 ${blocker.status === "active" ? "border-l-rose-500" : "border-l-emerald-500"}`}
            >
              <div
                className={`p-2 rounded-lg ${blocker.status === "active" ? "bg-rose-500/10" : "bg-emerald-500/10"}`}
              >
                <Shield
                  className={`w-4 h-4 ${blocker.status === "active" ? "text-rose-500" : "text-emerald-500"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[var(--text-primary)]">
                  {blocker.title}
                </p>
                {blocker.task_title && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("staffMisc.projectDetail.taskLabel", {
                      title: blocker.task_title,
                    })}
                  </p>
                )}
                {blocker.user_name && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("staffMisc.projectDetail.raisedBy", {
                      name: blocker.user_name,
                    })}
                  </p>
                )}
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${blocker.status === "active" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}
              >
                {t(BLOCKER_STATUS_LABELS[blocker.status] || blocker.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
