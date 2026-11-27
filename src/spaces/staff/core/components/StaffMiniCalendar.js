"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { addDays, dateKey, itemsOnDay, parseKey, timeLabel, weekStart } from "@/components/shared/calendar/calendarModel";

/**
 * MY CALENDAR — a compact month and the selected day's agenda.
 *
 * Pure view over the dashboard's normalized items. It tells the screen which
 * month it is on (`onMonthChange`) so the screen can read that month; the full
 * calendar stays one click away (`onFull`).
 */
export default function StaffMiniCalendar({ items, now, initialKey, onMonthChange, onFull, onOpenItem }) {
  const { t, lang } = useI18n();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const todayKey = dateKey(now);
  const [selected, setSelected] = useState(initialKey || todayKey);
  const [month, setMonth] = useState(() => {
    const start = parseKey(initialKey || todayKey);
    return { year: start.getFullYear(), month: start.getMonth() };
  });

  useEffect(() => {
    onMonthChange?.(month);
  }, [month, onMonthChange]);

  const cells = useMemo(() => {
    const start = weekStart(new Date(month.year, month.month, 1));
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [month]);
  const weekdays = useMemo(() => cells.slice(0, 7).map((day) => day.toLocaleDateString(locale, { weekday: "short" })), [cells, locale]);

  const move = (step) => setMonth((previous) => {
    const next = new Date(previous.year, previous.month + step, 1);
    return { year: next.getFullYear(), month: next.getMonth() };
  });
  const goToday = () => {
    setMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(todayKey);
  };

  const agenda = itemsOnDay(items, selected);
  const selectedDate = parseKey(selected);

  return (
    <div className="stf-mini">
      <div className="stf-mini-top">
        <button type="button" className="stf-link-btn" onClick={onFull}>
          {t("staffMisc.front.dashboard.fullCalendar")}
        </button>
      </div>

      <div className="stf-mini-nav">
        <b>{new Date(month.year, month.month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" })}</b>
        <span>
          <button type="button" className="stf-mini-ar" aria-label={t("staffMisc.front.calendar.previous")} onClick={() => move(-1)}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="stf-btn sm" onClick={goToday}>
            {t("time.today")}
          </button>
          <button type="button" className="stf-mini-ar" aria-label={t("staffMisc.front.calendar.next")} onClick={() => move(1)}>
            <ChevronRight size={16} />
          </button>
        </span>
      </div>

      <div className="stf-mini-grid" role="grid">
        {weekdays.map((name) => (
          <div key={name} className="wd">{name}</div>
        ))}
        {cells.map((day) => {
          const key = dateKey(day);
          const outside = day.getMonth() !== month.month;
          const busy = itemsOnDay(items, key).length > 0;
          return (
            <button
              key={key}
              type="button"
              className={`${outside ? "out " : ""}${key === selected ? "sel" : ""}`}
              aria-pressed={key === selected}
              aria-label={day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              onClick={() => setSelected(key)}
            >
              {day.getDate()}
              {busy && <i className="dot" />}
            </button>
          );
        })}
      </div>

      <div className="stf-mini-agenda">
        <div className="stf-mini-ah">
          <span>{selectedDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}</span>
          <span>{t("staffMisc.front.dashboard.eventsCount", { count: agenda.length })}</span>
        </div>
        {agenda.length === 0 ? (
          <div className="stf-empty-line">{t("staffMisc.front.dashboard.nothingThisDay")}</div>
        ) : (
          agenda.map((item) => (
            <button
              key={item.uid}
              type="button"
              className={`stf-mini-ev${item.kind === "meeting" ? " hot" : ""}`}
              onClick={() => onOpenItem?.(item)}
            >
              <span className="tm">{item.allDay ? t("staffMisc.front.calendar.allDay") : timeLabel(item.start)}</span>
              <span className="bar" />
              <span className="tx">
                <b>{item.title}</b>
                <small>
                  {item.start && item.end ? `${timeLabel(item.start)} – ${timeLabel(item.end)}` : t(`staffMisc.front.calendar.kind.${item.kind}`)}
                  {item.place ? ` · ${item.place}` : ""}
                </small>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
