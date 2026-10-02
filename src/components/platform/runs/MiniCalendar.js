import React from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// ─── Mini Calendar Picker ───
function MiniCalendar({ value, onChange, onClose }) {
  const { t } = useI18n();
  const [viewDate, setViewDate] = React.useState(() => value ? new Date(value) : new Date());
  const [timeStr, setTimeStr] = React.useState(() => {
    if (!value) return "09:00";
    const date = new Date(value);
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const MONTHS = [t("platformMisc.runs.monthJanuary"),t("platformMisc.runs.monthFebruary"),t("platformMisc.runs.monthMarch"),t("platformMisc.runs.monthApril"),t("platformMisc.runs.monthMay"),t("platformMisc.runs.monthJune"),t("platformMisc.runs.monthJuly"),t("platformMisc.runs.monthAugust"),t("platformMisc.runs.monthSeptember"),t("platformMisc.runs.monthOctober"),t("platformMisc.runs.monthNovember"),t("platformMisc.runs.monthDecember")];
  const DAYS = [t("platformMisc.runs.daySun"),t("platformMisc.runs.dayMon"),t("platformMisc.runs.dayTue"),t("platformMisc.runs.dayWed"),t("platformMisc.runs.dayThu"),t("platformMisc.runs.dayFri"),t("platformMisc.runs.daySat")];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let padIndex = 0; padIndex < firstDay; padIndex++) days.push(null);
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) days.push(dayNumber);

  const selectDay = (day) => {
    const date = new Date(year, month, day);
    const [hours, minutes] = timeStr.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
    onChange(date.toISOString().slice(0, 16));
    // Do NOT auto-close — let user confirm via the Done button
  };

  const handleTimeChange = (event) => {
    setTimeStr(event.target.value);
    if (value) {
      const date = new Date(value);
      const [hours, minutes] = event.target.value.split(":").map(Number);
      date.setHours(hours, minutes, 0, 0);
      onChange(date.toISOString().slice(0, 16));
    }
  };

  const isSelected = (day) => {
    if (!value || !day) return false;
    const date = new Date(value);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  };

  return (
    <div
      className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow-2xl w-96 z-[500]"
      onClick={(event) => event.stopPropagation()}
      style={{ background: "var(--bg-secondary, #1a1a2e)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
    >
      {/* Month Nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
        >
          <ChevronDown className="w-4 h-4 rotate-90 text-[var(--text-secondary)]" />
        </button>
        <span className="text-[14px] font-black text-[var(--text-primary)]">{MONTHS[month]} {year}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
        >
          <ChevronDown className="w-4 h-4 -rotate-90 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map((dayLabel) => (
          <div key={dayLabel} className="text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] py-1">{dayLabel}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const past = day && new Date(year, month, day, 23, 59, 59) < today;
          const isDaySelected = isSelected(day);
          return (
            <button
              key={index}
              type="button"
              disabled={!day || past}
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (day && !past) selectDay(day); }}
              className={
                "h-12 w-full rounded-xl text-[12px] font-bold transition-all " +
                (!day
                  ? "invisible"
                  : isDaySelected
                  ? "bg-[var(--brand-orange)] text-black shadow-md"
                  : past
                  ? "text-[var(--text-secondary)] opacity-25 cursor-not-allowed"
                  : "text-[var(--text-primary)] hover:bg-white/10 cursor-pointer")
              }
            >
              {day || ""}
            </button>
          );
        })}
      </div>

      {/* Time picker */}
      <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] block mb-2">{t("platformMisc.runs.time")}</label>
        <input
          type="time"
          value={timeStr}
          onChange={handleTimeChange}
          className="w-full px-3 py-2.5 rounded-xl bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none [color-scheme:dark]"
        />
      </div>

      {/* Selected date summary + Done */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-bold text-[var(--text-secondary)]">
          {value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : t("platformMisc.runs.noDateSelected")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
        >
          {t("platformMisc.runs.done")}
        </button>
      </div>
    </div>
  );
}

export default MiniCalendar;
