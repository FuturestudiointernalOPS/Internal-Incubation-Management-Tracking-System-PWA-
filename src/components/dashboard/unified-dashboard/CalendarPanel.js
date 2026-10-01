"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DAY_KEYS,
  EVENT_DOTS,
  MONTH_KEYS,
  cn,
  formatDate,
  getEventBar,
  getEventStyle,
  groupSameTitle,
  isToday,
} from "./constants";

/**
 * SECTION 1 — the unified calendar card: month, week and day views over the
 * dashboard's event feed, plus the source legend. Navigation and the selected
 * event stay with the screen; this block renders the month grid, the week rows
 * and the day list from the props it is handed.
 *
 * The month cells route a task event through `onMonthEventClick` (the screen
 * opens the task), while the week and day views use `onSelectEvent`.
 */
export default function CalendarPanel({
  t,
  lang,
  now,
  calMonth,
  calYear,
  calView,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  calendarDays,
  events,
  taskDays,
  onSelectEvent,
  onMonthEventClick,
}) {
  return (
    <div className="card !p-3">
      {/* Calendar header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("time.months." + MONTH_KEYS[calMonth])} {calYear}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggles */}
          <div className="flex gap-0.5 mr-2 border-r border-[var(--border-primary)] pr-2">
            {["month", "week", "day"].map((viewOption) => (
              <button
                key={viewOption}
                onClick={() => onViewChange(viewOption)}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded transition-all",
                  calView === viewOption
                    ? "bg-[var(--brand-orange)] text-black"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                {t("time.calendar." + viewOption)}
              </button>
            ))}
          </div>
          <button
            onClick={onPrev}
            className="p-1 rounded hover:bg-tertiary transition-all"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={onToday}
            className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
          >
            {t("time.today")}
          </button>
          <button
            onClick={onNext}
            className="p-1 rounded hover:bg-tertiary transition-all"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Month View */}
      {calView === "month" && (
        <div className="grid grid-cols-7 gap-px bg-[var(--border-primary)] rounded-lg overflow-hidden">
          {DAY_KEYS.map((dayKey) => (
            <div key={dayKey} className="bg-primary p-1 text-center">
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
                  className="bg-primary p-1 min-h-[55px]"
                />
              );
            const dateStr = formatDate(calYear, calMonth, day);
            const dayEvents = events.filter((event) => event.date === dateStr);
            const dayGroups = groupSameTitle(dayEvents);
            const current = isToday(new Date(calYear, calMonth, day));
            const past =
              new Date(calYear, calMonth, day) <
              new Date(new Date().toDateString());
            const isWeekStart =
              day === 1 || new Date(calYear, calMonth, day).getDay() === 0;
            const previousDay = new Date(calYear, calMonth, day - 1);
            const previousDateStr = formatDate(
              previousDay.getFullYear(),
              previousDay.getMonth(),
              previousDay.getDate(),
            );
            return (
              <div
                key={dateStr}
                className={cn(
                  "p-1 min-h-[55px] transition-all",
                  current
                    ? "bg-[var(--surface-1)] ring-2 ring-inset ring-brand-orange/60"
                    : "bg-primary",
                  past && "opacity-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-[10px] font-bold",
                      current
                        ? "min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand-orange)] text-white flex items-center justify-center"
                        : "text-[var(--text-secondary)]",
                    )}
                  >
                    {day}
                  </span>
                  {dayGroups.length > 0 && (
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)]">
                      {dayGroups.length}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5 mt-0.5 max-h-[90px] overflow-y-auto custom-scrollbar">
                  {dayGroups.map(({ primary: event }) => {
                    // In-between day of a multi-day task: a thin bar, the
                    // title only repeated at the start of each week row.
                    const isMiddle =
                      event.source === "task" &&
                      event.type === "task_active" &&
                      taskDays.has(`${event.related_id}:${previousDateStr}`);
                    return (
                    <button
                      key={event.id}
                      title={event.title}
                      aria-label={isMiddle && !isWeekStart ? event.title : undefined}
                      onClick={() => onMonthEventClick(event)}
                      className={
                        isMiddle && !isWeekStart
                          ? cn(
                              "block w-full h-1.5 my-1 rounded-full hover:opacity-100 transition-all",
                              getEventBar(event),
                            )
                          : cn(
                              "w-full text-left px-1 py-0.5 rounded text-[10px] font-semibold truncate leading-tight hover:brightness-110 transition-all",
                              getEventStyle(event),
                            )
                      }
                    >
                      {isMiddle && !isWeekStart ? null : event.title}
                    </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Week View */}
      {calView === "week" && (
        <div className="space-y-1.5">
          {(() => {
            const startOfWeek = new Date(calYear, calMonth, 1);
            startOfWeek.setDate(
              startOfWeek.getDate() - startOfWeek.getDay(),
            );
            return Array.from({ length: 7 }, (_, index) => {
              const date = new Date(startOfWeek);
              date.setDate(date.getDate() + index);
              const dateStr = formatDate(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
              );
              const dayEvents = events.filter((event) => event.date === dateStr);
              const current = isToday(date);
              return (
                <div
                  key={dateStr}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded-lg",
                    current
                      ? "bg-brand-orange/5 border border-brand-orange/20"
                      : "hover:bg-tertiary",
                  )}
                >
                  <div className="w-8 text-center shrink-0">
                    <p
                      className={cn(
                        "text-[10px] font-bold",
                        current
                          ? "text-[var(--brand-orange)]"
                          : "text-[var(--text-secondary)]",
                      )}
                    >
                      {date.getDate()}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      {t("time.days." + DAY_KEYS[date.getDay()])}
                    </p>
                  </div>
                  <div className="flex-1 space-y-1">
                    {dayEvents.length === 0 && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                        {t("common.noEvents")}
                      </p>
                    )}
                    {dayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onSelectEvent(event)}
                        className="block w-full text-left text-[11px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] truncate"
                      >
                        • {event.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Day View */}
      {calView === "day" && (
        <div className="space-y-1.5">
          {(() => {
            const today = new Date(calYear, calMonth, now.getDate());
            const dateStr = formatDate(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
            );
            const dayEvents = events.filter((event) => event.date === dateStr);
            return (
              <>
                <p className="text-[11px] font-bold text-[var(--text-primary)] mb-2">
                  {today.toLocaleDateString(lang, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {dayEvents.length === 0 && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("common.noEvents")}
                  </p>
                )}
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onSelectEvent(event)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-tertiary transition-all cursor-pointer border border-[var(--border-primary)]"
                  >
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        EVENT_DOTS[event.source] || "bg-slate-400",
                      )}
                    />
                    <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1 truncate">
                      {event.title}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {event.source}
                    </span>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-[var(--border-primary)]">
        {Object.entries(EVENT_DOTS).map(([key, dotClass]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", dotClass)} />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
