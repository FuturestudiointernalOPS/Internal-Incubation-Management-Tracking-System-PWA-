"use client";

import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The timeline tab: the project's activity entries, newest last.
 * Extracted verbatim from StaffProjectDetail.
 */
export default function TimelineTab({ timeline }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {timeline.length === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50">
          <Clock className="w-12 h-12 mb-3" />
          <p className="text-[10px] font-bold uppercase tracking-widest">
            {t("staffMisc.projectDetail.noActivityYet")}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
            {t("staffMisc.projectDetail.timelineEmptyHint")}
          </p>
        </div>
      ) : (
        timeline.map((entry, index) => (
          <div
            key={entry.id || index}
            className="card flex items-start gap-3 p-4"
          >
            <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--brand-orange)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                {entry.description || entry.action_type}
              </p>
              {entry.task_title && (
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                  {t("staffMisc.projectDetail.taskLabel", {
                    title: entry.task_title,
                  })}
                </p>
              )}
              {entry.actor_name && (
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                  {t("staffMisc.projectDetail.byActor", {
                    name: entry.actor_name,
                  })}
                </p>
              )}
            </div>
            <span className="text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
              {new Date(entry.created_at).toLocaleDateString()}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
