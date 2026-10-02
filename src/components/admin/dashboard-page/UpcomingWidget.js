"use client";

import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate, groupSameTitle } from "./constants";

/**
 * The widget listing today's and tomorrow's work, two entries each.
 * Extracted verbatim from app/admin/page.js.
 */
export default function UpcomingWidget({ calendarTasks, onSelectTask }) {
  const { t } = useI18n();
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
          {t("time.upcoming")}
        </span>
      </div>
      {(() => {
        const now = new Date();
        const ts = formatDate(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const tom = new Date(now);
        tom.setDate(tom.getDate() + 1);
        const tms = formatDate(
          tom.getFullYear(),
          tom.getMonth(),
          tom.getDate(),
        );
        const firstOfEachTitle = (tasks) =>
          groupSameTitle(tasks).map((group) => group.primary);
        const todayT = firstOfEachTitle(calendarTasks[ts] || []);
        const tomorrowT = firstOfEachTitle(calendarTasks[tms] || []);
        if (todayT.length === 0 && tomorrowT.length === 0)
          return (
            <p className="text-sm text-[var(--text-secondary)]">
              {t("time.noUpcoming")}
            </p>
          );
        return (
          <>
            {todayT.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                  {t("time.today")}
                </p>
                {todayT.slice(0, 2).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="block w-full text-left text-[11px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] truncate py-0.5"
                  >
                    • {task.title}
                  </button>
                ))}
              </div>
            )}
            {tomorrowT.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                  {t("time.tomorrow")}
                </p>
                {tomorrowT.slice(0, 2).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="block w-full text-left text-[11px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] truncate py-0.5"
                  >
                    • {task.title}
                  </button>
                ))}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}