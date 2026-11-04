"use client";

import { Calendar } from "lucide-react";
import { formatLocaleDate } from "@/lib/constants";
import { EVENT_DOTS, cn } from "./constants";

/**
 * THIS WEEK — the calendar's events that fall inside the current week.
 *
 * Extracted verbatim from UnifiedDashboard; the week range is computed once by
 * the screen and handed over.
 */
export default function UpcomingEventsCard({
  t,
  lang,
  events,
  weekDateRange,
  onSelectEvent,
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-blue-400" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {t("dashboard.thisWeek", "Cette Semaine")}
        </span>
      </div>
      <div className="space-y-1.5">
        {events
          .filter((event) => {
            const date = new Date(event.date);
            return date >= weekDateRange.start && date <= weekDateRange.end;
          })
          .slice(0, 5)
          .map((event) => (
            <button
              key={event.id}
              onClick={() => onSelectEvent(event)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-tertiary transition-all border border-transparent hover:border-[var(--border-primary)] text-left"
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  EVENT_DOTS[event.source] || "bg-slate-400",
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                  {event.title}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {formatLocaleDate(
                    event.date,
                    { weekday: "short", month: "short", day: "numeric" },
                    lang,
                  )}
                </p>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
