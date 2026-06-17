"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, X, Clock } from "lucide-react";

// ─── HELPERS ───────────────────────────────────────────────────────────────

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  return days;
}

function isToday(year, month, day) {
  const today = new Date();
  return (
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()
  );
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

const EVENT_COLORS = {
  task: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  program: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  session: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  deliverable: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  event: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

const EVENT_DOTS = {
  task: "bg-blue-400",
  program: "bg-emerald-400",
  session: "bg-amber-400",
  deliverable: "bg-purple-400",
  event: "bg-sky-400",
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * CalendarPanel — reusable compact calendar component.
 *
 * Props:
 *   events     – Array of { id, date: "YYYY-MM-DD", title, source?, type?, time?, status? }
 *   onEventClick – optional callback when an event chip is clicked
 *   compact    – boolean, if true renders extra tight for sidebar use (default false)
 */
export default function CalendarPanel({
  events = [],
  onEventClick,
  compact = false,
}) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const calendarDays = useMemo(
    () => getCalendarDays(year, month),
    [year, month],
  );

  const handlePrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };

  const handleNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const handleToday = () => {
    setMonth(now.getMonth());
    setYear(now.getFullYear());
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = formatDate(year, month, day);
    const dayEvents = getEventsForDate(dateStr);
    if (dayEvents.length > 0) {
      setSelectedDay({ date: dateStr, day, events: dayEvents });
    }
  };

  const getEventsForDate = (dateStr) => {
    return events.filter((e) => e.date === dateStr);
  };

  const closePopup = () => setSelectedDay(null);

  const daySize = compact
    ? "min-h-[32px] text-[8px]"
    : "min-h-[44px] text-[9px]";
  const headerSize = compact ? "text-[7px]" : "text-[8px]";
  const gap = compact ? "gap-1" : "gap-1.5";

  return (
    <>
      <div className="card">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePrev}
            className="p-1 rounded hover:bg-white/5 transition-all"
          >
            <ChevronLeft
              className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-slate-400`}
            />
          </button>
          <div className="flex items-center gap-2">
            <Calendar
              className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-[#FF6600]`}
            />
            <span
              className={`${compact ? "text-[9px]" : "text-[10px]"} font-black text-[var(--text-primary)] uppercase tracking-wider`}
            >
              {MONTHS[month]} {year}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleToday}
              className={`px-1.5 py-0.5 rounded ${compact ? "text-[7px]" : "text-[8px]"} font-black uppercase tracking-widest hover:bg-white/5 transition-all text-slate-500 hover:text-[var(--text-primary)]`}
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded hover:bg-white/5 transition-all"
            >
              <ChevronRight
                className={`${compact ? "w-3 h-3" : "w-3.5 h-3.5"} text-slate-400`}
              />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div
          className={`grid grid-cols-7 ${gap} text-center ${headerSize} font-black text-slate-500 uppercase tracking-widest mb-1.5`}
        >
          {DAY_HEADERS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className={`grid grid-cols-7 ${gap}`}>
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className={daySize} />;
            }
            const dateStr = formatDate(year, month, day);
            const dayEvents = getEventsForDate(dateStr);
            const today = isToday(year, month, day);
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={dateStr}
                onClick={() => handleDayClick(day)}
                className={cn(
                  `${daySize} flex flex-col items-center justify-center rounded-lg font-black transition-all cursor-pointer`,
                  today
                    ? "bg-[#FF6600] text-white shadow-lg shadow-[#FF6600]/30"
                    : hasEvents
                      ? "bg-[#FF6600]/15 text-[#FF6600] border border-[#FF6600]/20 hover:bg-[#FF6600]/25"
                      : "text-slate-600 hover:text-[var(--text-primary)] hover:bg-white/5",
                )}
              >
                <span
                  className={cn(
                    compact ? "text-[9px]" : "text-[10px]",
                    "leading-none",
                  )}
                >
                  {day}
                </span>
                {hasEvents && (
                  <span
                    className={`${compact ? "w-1 h-1 mt-0.5" : "w-1.5 h-1.5 mt-1"} rounded-full bg-[#FF6600]`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Compact event list below calendar */}
        {!compact && events.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border-primary)] space-y-1.5">
            {events.slice(0, 3).map((ev) => (
              <div
                key={ev.id}
                onClick={() => onEventClick?.(ev)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer group"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${EVENT_DOTS[ev.source] || "bg-slate-400"}`}
                />
                <span
                  className={`${compact ? "text-[8px]" : "text-[9px]"} font-bold text-[var(--text-primary)] flex-1 truncate`}
                >
                  {ev.title}
                </span>
                {ev.time && (
                  <span className="text-[7px] text-slate-500 flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                    <Clock className="w-2.5 h-2.5" />
                    {ev.time}
                  </span>
                )}
              </div>
            ))}
            {events.length > 3 && (
              <p className={`text-[7px] text-slate-500 text-center pt-0.5`}>
                +{events.length - 3} more
              </p>
            )}
          </div>
        )}
      </div>

      {/* ═══════ DAY POPUP ═══════ */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={closePopup}
        >
          <div
            className="bg-secondary border border-[var(--border-primary)] rounded-2xl w-full max-w-sm space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF6600]" />
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                  {new Date(year, month, selectedDay.day).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </h3>
              </div>
              <button
                onClick={closePopup}
                className="p-1 rounded-lg hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Events */}
            <div className="px-5 pb-5 space-y-2">
              {selectedDay.events.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic">
                  No events scheduled for this day
                </p>
              ) : (
                selectedDay.events.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => {
                      onEventClick?.(ev);
                      closePopup();
                    }}
                    className={cn(
                      "p-3 rounded-xl border cursor-pointer hover:brightness-110 transition-all",
                      EVENT_COLORS[ev.source] ||
                        "bg-slate-500/10 text-slate-400 border-slate-500/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold leading-tight flex-1">
                        {ev.title}
                      </p>
                      {ev.source && (
                        <span className="text-[7px] font-black uppercase tracking-wider opacity-60 shrink-0">
                          {ev.source}
                        </span>
                      )}
                    </div>
                    {(ev.time || ev.type) && (
                      <div className="flex items-center gap-3 mt-1.5">
                        {ev.time && (
                          <span className="text-[8px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {ev.time}
                          </span>
                        )}
                        {ev.type && (
                          <span className="text-[8px] text-slate-500 capitalize">
                            {ev.type.replace(/_/g, " ")}
                          </span>
                        )}
                        {ev.status && (
                          <span className="text-[8px] text-slate-500 capitalize">
                            {ev.status}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
