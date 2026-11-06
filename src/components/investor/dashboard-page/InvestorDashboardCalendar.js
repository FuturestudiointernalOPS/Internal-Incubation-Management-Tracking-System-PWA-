"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const EMPTY_WORKSPACES = [];
const pickWorkspaces = (payload) =>
  payload?.success && Array.isArray(payload.workspaces) ? payload.workspaces : EMPTY_WORKSPACES;

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function meetingDateKey(meeting) {
  if (meeting?.start_at) {
    const parsed = new Date(meeting.start_at);
    if (!Number.isNaN(parsed.getTime())) return toDateKey(parsed);
  }
  if (typeof meeting?.scheduled_date === "string" && meeting.scheduled_date) {
    return meeting.scheduled_date.slice(0, 10);
  }
  return null;
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * Month calendar for the investor dashboard — browse meetings by day.
 * Replaces the former pipeline / industry / weekly-activity charts.
 */
export default function InvestorDashboardCalendar({
  seedMeetings = [],
  fetchSlots = false,
  onOpenMeetings,
}) {
  const { t, lang } = useI18n();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const todayKey = toDateKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const { data: workspaces } = useApi(
    fetchSlots ? "/api/investor/meetings/slots" : null,
    { defaultValue: EMPTY_WORKSPACES, transform: pickWorkspaces },
  );

  const events = useMemo(() => {
    const byId = new Map();
    const add = (entry) => {
      if (!entry?.id || !entry.dateKey) return;
      byId.set(String(entry.id), entry);
    };

    seedMeetings.forEach((item) => {
      const meeting = item?.meeting || item;
      const ventureName =
        item?.relationship?.venture_name
        || item?.venture_name
        || meeting?.venture_name
        || t("dashboardV2.meeting");
      add({
        id: meeting?.id,
        dateKey: meetingDateKey(meeting),
        title: ventureName,
        startAt: meeting?.start_at || null,
        scheduledTime: meeting?.scheduled_time || null,
        videoLink: meeting?.video_link || null,
        status: meeting?.status || null,
      });
    });

    workspaces.forEach((workspace) => {
      (workspace.meetings || []).forEach((meeting) => {
        add({
          id: meeting.id,
          dateKey: meetingDateKey(meeting),
          title: workspace.venture_name || t("dashboardV2.meeting"),
          startAt: meeting.start_at || null,
          scheduledTime: meeting.scheduled_time || null,
          videoLink: meeting.video_link || null,
          status: meeting.status || null,
        });
      });
    });

    return [...byId.values()];
  }, [seedMeetings, workspaces, t]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      if (!event.dateKey) return;
      const list = map.get(event.dateKey) || [];
      list.push(event);
      map.set(event.dateKey, list);
    });
    return map;
  }, [events]);

  const cells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const selectedEvents = eventsByDay.get(selectedKey) || [];

  const shiftMonth = (delta) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedKey(todayKey);
  };

  const formatTime = (event) => {
    if (event.startAt) {
      const parsed = new Date(event.startAt);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
      }
    }
    if (event.scheduledTime) return event.scheduledTime.slice(0, 5);
    return t("dashboardV2.timeToBeSet");
  };

  return (
    <section className="stf-card" aria-label={t("dashboardV2.calendarTitle")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="stf-card-title">{t("dashboardV2.calendarTitle")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <AppButton variant="ghost" size="sm" onClick={goToday}>
            {t("time.today")}
          </AppButton>
          <AppButton
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            aria-label={t("dashboardV2.calendarPrev")}
            onClick={() => shiftMonth(-1)}
          />
          <span className="min-w-[10rem] text-center text-sm font-bold text-[var(--text-primary)]">
            {t(`time.months.${MONTH_KEYS[cursor.month]}`)} {cursor.year}
          </span>
          <AppButton
            variant="ghost"
            size="sm"
            icon={ChevronRight}
            aria-label={t("dashboardV2.calendarNext")}
            onClick={() => shiftMonth(1)}
          />
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-7 gap-1 text-center"
        role="grid"
        aria-label={t("dashboardV2.calendarTitle")}
      >
        {DAY_KEYS.map((dayKey) => (
          <div key={dayKey} className="stf-small py-1 font-bold uppercase tracking-wide" role="columnheader">
            {t(`time.days.${dayKey}`)}
          </div>
        ))}
        {cells.map((date, index) => {
          if (!date) {
            return <div key={`pad-${index}`} className="min-h-14 rounded-lg bg-transparent" />;
          }
          const key = toDateKey(date);
          const dayEvents = eventsByDay.get(key) || [];
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-pressed={isSelected}
              aria-label={`${date.toLocaleDateString(locale)}${dayEvents.length ? `, ${dayEvents.length}` : ""}`}
              onClick={() => setSelectedKey(key)}
              className={[
                "min-h-14 rounded-lg border p-1.5 text-left transition-colors",
                isSelected
                  ? "border-[var(--brand-orange)] bg-brand-orange/10"
                  : "border-[var(--border-primary)] bg-surface-1 hover:bg-surface-2",
                isToday && !isSelected ? "ring-1 ring-[var(--brand-orange)]/40" : "",
              ].join(" ")}
            >
              <span className={`block text-xs font-bold ${isToday ? "text-[var(--brand-orange)]" : "text-[var(--text-primary)]"}`}>
                {date.getDate()}
              </span>
              {dayEvents.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="h-1.5 w-1.5 rounded-full bg-[var(--brand-orange)]"
                      title={event.title}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-[var(--border-primary)] pt-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h3>
        {selectedEvents.length === 0 ? (
          <p className="stf-small mt-2">{t("dashboardV2.calendarEmptyDay")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {selectedEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2"
              >
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{event.title}</p>
                  <p className="stf-small">{formatTime(event)}</p>
                </div>
                {event.videoLink ? (
                  <a
                    className="stf-btn"
                    href={event.videoLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("investorMisc.meetings.join")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {typeof onOpenMeetings === "function" && (
          <div className="mt-3">
            <AppButton variant="secondary" size="sm" onClick={onOpenMeetings}>
              {t("dashboardV2.calendarOpenMeetings")}
            </AppButton>
          </div>
        )}
      </div>
    </section>
  );
}
