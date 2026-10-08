"use client";

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  DAY_KEYS,
  MONTH_KEYS,
  STATUS_CONFIG,
  calendarTaskTone,
  cn,
  formatDate,
  groupSameTitle,
  isToday,
  statusLabel,
} from "./constants";

/**
 * The month grid: one cell per day, each listing the work due on it — a task
 * spanning several days drawn as a quiet bar on its in-between days — plus the
 * status legend underneath.
 * Extracted verbatim from app/admin/page.js. Optional `headerAction` (rendered
 * before the month navigation — the Google Calendar control) and `extraLegend`
 * ([{ key, label, dot }]) extend it without changing the default rendering.
 */
export default function CalendarPanel({
  year,
  month,
  calendarDays,
  calendarTasks,
  calendarSpans,
  expandedDays,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectTask,
  onExpandDay,
  headerAction = null,
  extraLegend = [],
}) {
  const { t } = useI18n();
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("time.months." + MONTH_KEYS[month])} {year}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {headerAction}
          <button
            onClick={onPrevMonth}
            className="p-1.5 rounded-lg hover:bg-tertiary transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onToday}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
          >
            {t("time.today")}
          </button>
          <button
            onClick={onNextMonth}
            className="p-1.5 rounded-lg hover:bg-tertiary transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-[var(--border-primary)] rounded-lg overflow-hidden">
        {DAY_KEYS.map((dayKey) => (
          <div key={dayKey} className="bg-primary p-2 text-center">
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {t("time.days." + dayKey)}
            </span>
          </div>
        ))}
        {calendarDays.map((day, index) => {
          if (day === null)
            return (
              <div
                key={`empty-${index}`}
                className="bg-primary p-2 min-h-[90px]"
              />
            );
          const dateStr = formatDate(year, month, day);
          const dayTasks = groupSameTitle(calendarTasks[dateStr] || []);
          const isCurrent = isToday(new Date(year, month, day));
          const isPast =
            new Date(year, month, day) <
            new Date(new Date().toDateString());
          const isWeekStart =
            day === 1 || new Date(year, month, day).getDay() === 0;
          const expanded = expandedDays[dateStr];
          return (
            <div
              key={dateStr}
              className={cn(
                "p-1.5 min-h-[90px] transition-all",
                isCurrent
                  ? "bg-[var(--surface-1)] ring-2 ring-inset ring-brand-orange/60"
                  : "bg-primary",
                isPast && "opacity-60",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    isCurrent
                      ? "min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand-orange)] text-white flex items-center justify-center"
                      : "text-[var(--text-secondary)]",
                  )}
                >
                  {day}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)]">
                    {dayTasks.length}
                  </span>
                )}
              </div>
              <div className={`space-y-0.5 ${expanded ? "max-h-[200px]" : ""} overflow-y-auto custom-scrollbar`}>
                {dayTasks.slice(0, expanded ? undefined : 3).map(({ primary: task }) => {
                  const tone = calendarTaskTone(task);
                  // In-between days of a multi-day task: a thin bar, with
                  // the title repeated only at the start of each week row.
                  if (calendarSpans[`${dateStr}:${task.id}`] === "middle" && !isWeekStart) {
                    return (
                      <button
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        title={task.title}
                        aria-label={task.title}
                        className={cn(
                          "block w-full h-1.5 my-1 rounded-full hover:opacity-100 transition-all",
                          tone.bar,
                          task.status === "completed" ? "opacity-30" : "opacity-60",
                        )}
                      />
                    );
                  }
                  return (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      title={task.title}
                      className={cn(
                        "w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate leading-tight hover:brightness-110 transition-all",
                        tone.chip,
                      )}
                    >
                      {task.title}
                    </button>
                  );
                })}
                {dayTasks.length > 3 && !expanded && (
                  <button
                    onClick={() => onExpandDay(dateStr, true)}
                    className="w-full text-center py-0.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary rounded transition-all"
                  >
                    +{dayTasks.length - 3} {t("common.more")}
                  </button>
                )}
                {expanded && dayTasks.length > 3 && (
                  <button
                    onClick={() => onExpandDay(dateStr, false)}
                    className="w-full text-center py-0.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary rounded transition-all"
                  >
                    {t("common.showLess")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[var(--border-primary)]">
        {Object.entries(STATUS_CONFIG).map(([key, statusConfig]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {statusLabel(t, key)}
            </span>
          </div>
        ))}
        {extraLegend.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${item.dot}`} />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}