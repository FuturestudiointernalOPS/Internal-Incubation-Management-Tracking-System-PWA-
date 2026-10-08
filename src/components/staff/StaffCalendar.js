"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";
import {
  KINDS,
  SETTABLE_STATUSES,
  TASK_STATUSES,
  addDays,
  countByStatus,
  dateKey,
  daysOfView,
  hourRange,
  itemsOnDay,
  layoutTimed,
  matches,
  monthsNeeded,
  normalizeEvents,
  parseKey,
  sameDay,
  timeLabel,
  validateForm,
} from "./calendarModel";
import { notify } from "./notify";

const ROW = 60; // px per hour in the day/week grid
const MONTH_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const STATUS_COLOR = {
  pending: "var(--stf-wait)",
  in_progress: "var(--stf-act)",
  blocked: "var(--stf-crit)",
  completed: "var(--stf-done)",
  carried_over: "var(--stf-lav)",
};

const PATHS = {
  down: <path d="m6 9 6 6 6-6" />,
  l: <path d="m15 18-6-6 6-6" />,
  r: <path d="m9 18 6-6-6-6" />,
  more: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  ),
  plus: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  video: (
    <>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  flag: (
    <>
      <path d="M4 22V4" />
      <path d="M4 4h13l-2 4 2 4H4" />
    </>
  ),
};
function Ico({ name, className = "" }) {
  return (
    <svg className={`x-i ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/**
 * STAFF CALENDAR — day / week / month over the dashboard's event feed.
 *
 * Data in:  `events` (the dashboard payload's calendar events, merged across the
 *           months in view). The component asks for more months through
 *           `onRangeChange` when the view reaches into another month.
 * Actions:  status change, task/meeting creation and opening a task go through
 *           the callbacks, which own the requests — this component only draws.
 */
export default function StaffCalendar({
  events,
  now,
  loading,
  onRangeChange,
  onOpenTask,
  onSetStatus,
  onCreateTask,
  onCreateMeeting,
  formRequest,
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const locale = lang === "fr" ? "fr-FR" : "en-US";

  const [anchor, setAnchor] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [chosenMode, setChosenMode] = useState(null);
  const [narrow, setNarrow] = useState(false);
  const [status, setStatus] = useState("all");
  const [statusOpen, setStatusOpen] = useState(false);
  const [on, setOn] = useState({ task: true, meeting: true, milestone: true });
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(null); // { uid, top, left }
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const scrollRef = useRef(null);
  const filterRef = useRef(null);

  useEffect(() => {
    const measure = () => setNarrow(window.innerWidth < 700);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const mode = chosenMode || (narrow ? "day" : "week");
  const days = useMemo(() => daysOfView(mode, anchor), [mode, anchor]);
  const items = useMemo(() => normalizeEvents(events), [events]);

  // Tell the screen which months this view needs, so it can load them. `days`
  // only changes with the view or the anchor, and the screen's callback is stable.
  useEffect(() => {
    onRangeChange?.(monthsNeeded(days));
  }, [days, onRangeChange]);

  const counts = useMemo(() => countByStatus(items, days, query), [items, days, query]);
  const visibleOn = (key) => itemsOnDay(items, key).filter((item) => matches(item, { on, status, query }));
  const itemByUid = useMemo(() => new Map(items.map((item) => [item.uid, item])), [items]);

  // Keep the grid near the working hours when the view changes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 30;
  }, [mode, anchor]);

  // Click outside closes the popovers; the menu also closes on scroll.
  useEffect(() => {
    const onDown = (event) => {
      if (statusOpen && filterRef.current && !filterRef.current.contains(event.target)) setStatusOpen(false);
      if (menu && !event.target.closest?.(".x-menu") && !event.target.closest?.("[data-kebab]")) setMenu(null);
    };
    const onScroll = (event) => {
      if (menu && !event.target.closest?.(".x-menu")) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [statusOpen, menu]);

  const statusLabel = (value) => t(`staffMisc.front.status.${value}`);
  const dotFor = (value) => (value === "all" ? "var(--text-secondary)" : STATUS_COLOR[value]);
  const longDate = (date) => date.toLocaleDateString(locale, { day: "numeric", month: "long" });
  const monthTitle = `${t(`time.months.${MONTH_KEYS[anchor.getMonth()]}`)} ${anchor.getFullYear()}`;

  const first = days[0];
  const last = days[days.length - 1];
  const range =
    mode === "day"
      ? first.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
      : mode === "month"
        ? monthTitle
        : `${first.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${last.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;

  function defaultDate() {
    if (mode === "month") {
      return anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth()
        ? new Date(now)
        : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    }
    return days.some((day) => sameDay(day, now)) ? new Date(now) : days[0];
  }

  function buildForm(date, hour = 9, type) {
    const end = Math.min(23, hour + 1);
    return {
      type: type || (!on.task && on.meeting ? "meeting" : "task"),
      title: "",
      date: dateKey(date),
      start: `${String(hour).padStart(2, "0")}:00`,
      end: `${String(end).padStart(2, "0")}:00`,
      status: "pending",
      place: "",
      error: "",
      busy: false,
    };
  }

  function openForm(date, hour, type) {
    setStatusOpen(false);
    setMenu(null);
    setForm(buildForm(date, hour, type));
  }

  // The "new task / meeting" button on the dashboard hero asks for the form
  // through `formRequest`. Each request has its own id; one that has not been
  // answered yet opens the form — decided here, while rendering, so no effect
  // has to copy a prop into state.
  const [answeredRequest, setAnsweredRequest] = useState(null);
  if (formRequest && formRequest.id !== answeredRequest) {
    setAnsweredRequest(formRequest.id);
    setForm(buildForm(defaultDate(), 9, formRequest.type));
  }

  const move = (direction) => {
    if (mode === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
    else setAnchor(addDays(anchor, direction * (mode === "week" ? 7 : 1)));
  };
  const goDay = (date) => {
    setAnchor(date);
    setChosenMode("day");
    setMenu(null);
  };

  const openMenu = (event, uid) => {
    event.stopPropagation();
    if (menu?.uid === uid) {
      setMenu(null);
      return;
    }
    const item = itemByUid.get(uid);
    if (!item) return;
    const box = event.currentTarget.getBoundingClientRect();
    const width = 210;
    const height = item.kind === "task" ? 230 : 84;
    const left = Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8));
    let top = box.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, box.top - height - 6);
    setStatusOpen(false);
    setMenu({ uid, top, left });
  };

  const changeStatus = async (item, next) => {
    setMenu(null);
    if (item.status === next) return;
    const result = await onSetStatus(item, next);
    if (result?.ok) notify("success", t("staffMisc.front.calendar.statusChanged", { title: item.title, status: statusLabel(next) }));
    else notify("error", result?.error || t("staffMisc.front.calendar.statusFailed"));
  };

  const showDetails = (item) => {
    setMenu(null);
    setDetail(item);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const problem = validateForm(form);
    if (problem) {
      setForm({ ...form, error: t(`staffMisc.front.calendar.error.${problem}`) });
      return;
    }
    setForm({ ...form, busy: true, error: "" });
    const result = form.type === "meeting" ? await onCreateMeeting(form) : await onCreateTask(form);
    if (!result?.ok) {
      setForm({ ...form, busy: false, error: result?.error || t("staffMisc.front.calendar.error.save") });
      return;
    }
    const date = parseKey(form.date);
    setOn((previous) => ({ ...previous, [form.type]: true }));
    setStatus("all");
    setAnchor(date);
    setForm(null);
    notify(
      "success",
      t(form.type === "meeting" ? "staffMisc.front.calendar.meetingAdded" : "staffMisc.front.calendar.taskAdded", {
        date: longDate(date),
      }),
    );
  };

  /* ── pieces ── */
  const kebab = (item) => {
    const label =
      item.kind === "task"
        ? t("staffMisc.front.calendar.changeStatusAria", { title: item.title, status: statusLabel(item.status) })
        : t("staffMisc.front.calendar.optionsAria", { title: item.title });
    return (
      <button
        type="button"
        className="kb"
        data-kebab={item.uid}
        aria-haspopup="menu"
        aria-expanded={menu?.uid === item.uid}
        aria-label={label}
        onClick={(event) => openMenu(event, item.uid)}
      >
        <Ico name="more" />
      </button>
    );
  };

  const openItem = (item) => (item.kind === "task" ? onOpenTask(item) : showDetails(item));
  const timeChip = (item) => (item.allDay ? null : <b>{timeLabel(item.start)}</b>);

  const chip = (item) => {
    if (item.kind === "task" && item.position === "mid") {
      return <div key={item.uid} className="x-mid" style={{ "--c": STATUS_COLOR[item.status] }} title={item.title} />;
    }
    if (item.kind === "task") {
      return (
        <div key={item.uid} className="x-it tk x-grp" style={{ "--c": STATUS_COLOR[item.status] }} title={`${item.title} · ${statusLabel(item.status)}`}>
          <i className="x-dot" />
          <button type="button" className={`x-tt${item.status === "completed" ? " x-done" : ""}`} onClick={() => openItem(item)}>
            {item.title}
          </button>
          <span className="kbw">{kebab(item)}</span>
        </div>
      );
    }
    const isMeeting = item.kind === "meeting";
    return (
      <div key={item.uid} className={`x-it ${isMeeting ? "mt" : "ms"} x-grp`} title={`${item.title}${item.place ? ` · ${item.place}` : ""}`}>
        <Ico name={isMeeting ? "video" : "flag"} />
        <button type="button" className="x-tt" onClick={() => openItem(item)}>
          {timeChip(item)}
          {item.title}
        </button>
        <span className="kbw">{kebab(item)}</span>
      </div>
    );
  };

  const renderMonth = () => {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;
    const tail = (7 - ((lead + days.length) % 7)) % 7;
    const cells = [];
    for (let index = 0; index < lead; index += 1) cells.push([new Date(year, month, 1 - lead + index), true]);
    days.forEach((day) => cells.push([day, false]));
    for (let index = 1; index <= tail; index += 1) cells.push([new Date(year, month + 1, index), true]);
    const todayColumn = cells.findIndex(([day]) => sameDay(day, now)) % 7;
    return (
      <div className="x-mgrid">
        {DAY_KEYS.map((key, index) => (
          <div key={key} className={`x-dh${index === todayColumn ? " t" : ""}`}>
            {t(`time.days.${key}`)}
          </div>
        ))}
        {cells.map(([day, muted]) => {
          const key = dateKey(day);
          const shown = visibleOn(key);
          const isToday = sameDay(day, now);
          return (
            <div
              key={key}
              className="x-cell"
              onClick={(event) => {
                if (!event.target.closest("[data-ev]") && !event.target.closest("button")) goDay(day);
              }}
            >
              <button
                type="button"
                className={`x-dn${isToday ? " t" : muted ? " mu" : ""}`}
                aria-label={t("staffMisc.front.calendar.viewDay", { date: longDate(day) })}
                aria-current={isToday ? "date" : undefined}
                onClick={() => goDay(day)}
              >
                {day.getDate()}
              </button>
              <div className="x-items" data-ev>
                {shown.slice(0, 3).map(chip)}
                {shown.length > 3 && (
                  <button type="button" className="x-more" onClick={() => goDay(day)}>
                    {t("staffMisc.front.calendar.more", { count: shown.length - 3 })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGrid = () => {
    const perDay = days.map((day) => visibleOn(dateKey(day)));
    const timedAll = perDay.flat().filter((item) => !item.allDay);
    const { first: h0, last: h1 } = hourRange(timedAll);
    const columns = `52px repeat(${days.length}, minmax(0, 1fr))`;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const showNow = nowMinutes >= h0 * 60 && nowMinutes <= h1 * 60;
    const todayShown = days.some((day) => sameDay(day, now));
    const total = perDay.reduce((sum, list) => sum + list.length, 0);
    const hasAllDay = perDay.some((list) => list.some((item) => item.allDay));

    return (
      <div className="x-scroll" ref={scrollRef}>
        <div style={{ minWidth: mode === "week" ? 840 : undefined }}>
          <div className="x-gh" style={{ gridTemplateColumns: columns }}>
            <div />
            {days.map((day) => {
              const isToday = sameDay(day, now);
              const label = longDate(day);
              return (
                <div key={dateKey(day)} className={`x-hc${mode === "day" ? " day" : ""}${isToday ? " t" : ""}`}>
                  <span className="wd">{t(`time.days.${DAY_KEYS[(day.getDay() + 6) % 7]}`)}</span>
                  {mode === "week" ? (
                    <button type="button" className="dd" onClick={() => goDay(day)} aria-label={t("staffMisc.front.calendar.viewDay", { date: label })} aria-current={isToday ? "date" : undefined}>
                      {day.getDate()}
                    </button>
                  ) : (
                    <span className="dd" aria-current={isToday ? "date" : undefined}>
                      {day.getDate()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {hasAllDay && (
            <div className="x-ad" style={{ gridTemplateColumns: columns }}>
              <div className="x-adl">{t("staffMisc.front.calendar.allDay")}</div>
              {perDay.map((list, index) => (
                <div key={dateKey(days[index])} className="x-adc" data-ev>
                  {list.filter((item) => item.allDay).map(chip)}
                </div>
              ))}
            </div>
          )}

          <div className="x-gb" style={{ gridTemplateColumns: columns }}>
            <div className="x-hr" style={{ height: (h1 - h0) * ROW }} aria-hidden="true">
              {Array.from({ length: h1 - h0 }, (_, index) => {
                if (showNow && todayShown && Math.abs((nowMinutes / 60 - h0 - index) * ROW) < 12) return null;
                return (
                  <span key={index} style={{ top: index * ROW, transform: index === 0 ? "translateY(2px)" : "translateY(-50%)" }}>
                    {String(h0 + index).padStart(2, "0")}:00
                  </span>
                );
              })}
              {showNow && todayShown && (
                <span className="nowb" style={{ top: (nowMinutes / 60 - h0) * ROW }}>
                  {timeLabel([now.getHours(), now.getMinutes()])}
                </span>
              )}
            </div>
            {perDay.map((list, index) => {
              const day = days[index];
              const laid = layoutTimed(list.filter((item) => !item.allDay));
              return (
                <div
                  key={dateKey(day)}
                  className="x-col"
                  style={{ height: (h1 - h0) * ROW }}
                  onClick={(event) => {
                    if (event.target.closest("[data-ev]")) return;
                    const box = event.currentTarget.getBoundingClientRect();
                    const at = Math.floor((((event.clientY - box.top) / ROW) * 60) / 30) * 30 + h0 * 60;
                    openForm(day, Math.floor(Math.max(0, Math.min(23 * 60, at)) / 60), "meeting");
                  }}
                >
                  {laid.map(({ item, from, to, lane, lanes }) => {
                    const top = (from / 60 - h0) * ROW;
                    const height = Math.max(((to - from) / 60) * ROW - 2, 40);
                    const short = to - from < 45;
                    const position =
                      lanes > 1
                        ? { left: `calc(4px + (100% - 10px) * ${lane} / ${lanes})`, width: `calc((100% - 10px) / ${lanes})` }
                        : { left: 4, right: 6 };
                    const rangeText = `${timeLabel(item.start)} – ${timeLabel(item.end)}`;
                    return (
                      <div key={item.uid} className="x-ab mt x-grp" data-ev style={{ top, minHeight: short ? 26 : height, ...position }} title={`${rangeText} · ${item.title}${item.place ? ` · ${item.place}` : ""}`}>
                        <Ico name="video" />
                        <button type="button" className={short ? "x-sh" : ""} style={{ background: "none", border: 0, padding: 0, textAlign: "left", color: "inherit", width: "100%" }} onClick={() => showDetails(item)}>
                          <b className={short ? "mr6" : "blk"}>{short ? timeLabel(item.start) : rangeText}</b>
                          {item.title}
                          {item.place && !short ? <span className="pl"> · {item.place}</span> : null}
                        </button>
                        {kebab(item)}
                      </div>
                    );
                  })}
                  {sameDay(day, now) && showNow && <div className="x-nowl" style={{ top: (nowMinutes / 60 - h0) * ROW }} />}
                </div>
              );
            })}
            {total === 0 && <div className="x-none">{t("staffMisc.front.calendar.nothing")}</div>}
          </div>
        </div>
      </div>
    );
  };

  const menuItem = menu ? itemByUid.get(menu.uid) : null;
  const patchForm = (patch) => setForm((previous) => ({ ...previous, ...patch, error: "" }));

  return (
    <div className="stf-cal-card">
      <div className="stf-cal">
        <section aria-label={t("staffMisc.front.calendar.title")}>
          <div className="x-bar1">
            <div className="x-rel" ref={filterRef}>
              <button
                type="button"
                className="x-fb"
                disabled={!on.task}
                title={!on.task ? t("staffMisc.front.calendar.statusFilterTasksOnly") : undefined}
                aria-haspopup="listbox"
                aria-expanded={statusOpen}
                aria-label={t("staffMisc.front.calendar.filterByStatus")}
                onClick={() => {
                  setMenu(null);
                  setStatusOpen(!statusOpen);
                }}
              >
                <i className="x-dot" style={{ background: dotFor(status) }} />
                <span>{status === "all" ? t("staffMisc.front.calendar.allPlanned") : statusLabel(status)}</span>
                <span className="x-pl">{counts[status]}</span>
                <Ico name="down" className={`x-i14 x-chev${statusOpen ? " o" : ""}`} />
              </button>
              {statusOpen && (
                <div className="x-pop" role="listbox" aria-label={t("staffMisc.front.calendar.filterByStatus")}>
                  {["all", ...TASK_STATUSES].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={status === value}
                      className={`x-op${status === value ? " s" : ""}`}
                      onClick={() => {
                        setStatus(value);
                        setStatusOpen(false);
                      }}
                    >
                      <i className="x-dot" style={{ background: dotFor(value) }} />
                      {value === "all" ? t("staffMisc.front.calendar.allPlanned") : statusLabel(value)}
                      <span className="x-pl b">{counts[value]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="x-types" role="group" aria-label={t("staffMisc.front.calendar.kinds")}>
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`x-tg${kind === "meeting" ? " m" : ""}${on[kind] ? " on" : ""}`}
                  aria-pressed={on[kind]}
                  onClick={() => {
                    const other = KINDS.filter((value) => value !== kind);
                    const next = { ...on, [kind]: !on[kind] };
                    if (!next[kind] && other.every((value) => !next[value])) next[other[0]] = true;
                    setOn(next);
                  }}
                >
                  {kind === "meeting" ? <Ico name="video" className="x-i14" /> : kind === "milestone" ? <Ico name="flag" className="x-i14" /> : <i className="x-dot" />}
                  {t(`staffMisc.front.calendar.kind.${kind}`)}
                  <span className="x-pl">{kind === "task" ? counts.tasks : kind === "meeting" ? counts.meetings : counts.milestones}</span>
                </button>
              ))}
            </div>
            <div className="x-right">
              <label className="x-sr">
                <Ico name="search" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("staffMisc.front.calendar.search")} aria-label={t("staffMisc.front.calendar.searchAria")} />
              </label>
              <button type="button" className="x-btn p sm" onClick={() => openForm(defaultDate())}>
                <Ico name="plus" />
                {t("staffMisc.front.calendar.add")}
              </button>
            </div>
          </div>

          <div className="x-bar2" role="group" aria-label={t("staffMisc.front.calendar.navigation")}>
            <h3 className="x-h3">{monthTitle}</h3>
            <button type="button" className="x-nb" onClick={() => move(-1)} aria-label={t("staffMisc.front.calendar.previous")}>
              <Ico name="l" />
            </button>
            <button type="button" className="x-today" onClick={() => setAnchor(new Date(now.getFullYear(), now.getMonth(), now.getDate()))}>
              {t("staffMisc.front.calendar.today")}
            </button>
            <button type="button" className="x-nb" onClick={() => move(1)} aria-label={t("staffMisc.front.calendar.next")}>
              <Ico name="r" />
            </button>
            <span className="x-flex1" />
            <div className="x-seg" role="group" aria-label={t("staffMisc.front.calendar.viewType")}>
              {["day", "week", "month"].map((value) => (
                <button key={value} type="button" className={mode === value ? "on" : ""} aria-pressed={mode === value} onClick={() => { setChosenMode(value); setMenu(null); }}>
                  {t(`staffMisc.front.calendar.mode.${value}`)}
                </button>
              ))}
            </div>
            <span className="x-range" aria-label={t("staffMisc.front.calendar.period")}>
              {range}
            </span>
          </div>

          {loading && events.length === 0 ? <div className="stf-empty">{t("common.loading")}</div> : mode === "month" ? renderMonth() : renderGrid()}

          <div className="x-leg">
            {TASK_STATUSES.map((value) => (
              <span key={value}>
                <i style={{ background: STATUS_COLOR[value] }} />
                {statusLabel(value)}
              </span>
            ))}
          </div>

          {menu && menuItem && (
            <div className="x-menu" role="menu" aria-label={menuItem.kind === "task" ? t("staffMisc.front.calendar.taskStatus") : t("staffMisc.front.calendar.details")} style={{ top: menu.top, left: menu.left }}>
              <p>{menuItem.kind === "task" ? t("staffMisc.front.calendar.taskStatus") : t("staffMisc.front.calendar.details")}</p>
              {menuItem.kind === "task" ? (
                SETTABLE_STATUSES.map((value) => (
                  <button key={value} type="button" role="menuitemradio" aria-checked={menuItem.status === value} className={`x-op${menuItem.status === value ? " s" : ""}`} onClick={() => changeStatus(menuItem, value)}>
                    <i className="sw" style={{ background: STATUS_COLOR[value] }} />
                    {statusLabel(value)}
                    {menuItem.status === value && <span className="ck" aria-hidden="true">✓</span>}
                  </button>
                ))
              ) : (
                <button type="button" role="menuitem" className="x-op" onClick={() => showDetails(menuItem)}>
                  {t("staffMisc.front.calendar.seeDetails")}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* New task / meeting */}
      <AppModal isOpen={!!form} onClose={() => setForm(null)} title={form ? t(form.type === "meeting" ? "staffMisc.front.calendar.newMeeting" : "staffMisc.front.calendar.newTask") : ""} size="sm">
        {form && (
          <form className="stf stf-form" onSubmit={submitForm} noValidate>
            <div className="stf-tabs" role="group" aria-label={t("staffMisc.front.calendar.type")}>
              {["task", "meeting"].map((value) => (
                <button key={value} type="button" className={form.type === value ? "on" : ""} aria-pressed={form.type === value} onClick={() => patchForm({ type: value })}>
                  {t(`staffMisc.front.calendar.kind.${value}`)}
                </button>
              ))}
            </div>
            <p className="stf-sub" style={{ margin: 0 }}>
              {t(form.type === "meeting" ? "staffMisc.front.calendar.meetingHint" : "staffMisc.front.calendar.taskHint")}
            </p>
            <div className="stf-field">
              <label className="stf-k" htmlFor="stf-f-title">{t("staffMisc.front.calendar.fieldTitle")}</label>
              <input id="stf-f-title" className="stf-input" maxLength={120} autoComplete="off" value={form.title} onChange={(event) => patchForm({ title: event.target.value })} placeholder={t(form.type === "meeting" ? "staffMisc.front.calendar.placeholderMeeting" : "staffMisc.front.calendar.placeholderTask")} />
            </div>
            <div className="stf-field">
              <label className="stf-k" htmlFor="stf-f-date">{t("staffMisc.front.calendar.fieldDate")}</label>
              <input id="stf-f-date" type="date" className="stf-input" value={form.date} onChange={(event) => patchForm({ date: event.target.value })} />
            </div>
            {form.type === "meeting" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="stf-field">
                    <label className="stf-k" htmlFor="stf-f-start">{t("staffMisc.front.calendar.fieldStart")}</label>
                    <input id="stf-f-start" type="time" step="900" className="stf-input" value={form.start} onChange={(event) => patchForm({ start: event.target.value })} />
                  </div>
                  <div className="stf-field">
                    <label className="stf-k" htmlFor="stf-f-end">{t("staffMisc.front.calendar.fieldEnd")}</label>
                    <input id="stf-f-end" type="time" step="900" className="stf-input" value={form.end} onChange={(event) => patchForm({ end: event.target.value })} />
                  </div>
                </div>
                <div className="stf-field">
                  <label className="stf-k" htmlFor="stf-f-place">{t("staffMisc.front.calendar.fieldPlace")}</label>
                  <input id="stf-f-place" className="stf-input" maxLength={120} autoComplete="off" value={form.place} onChange={(event) => patchForm({ place: event.target.value })} placeholder={t("staffMisc.front.calendar.placeholderPlace")} />
                </div>
              </>
            ) : (
              <div className="stf-field">
                <label className="stf-k" htmlFor="stf-f-status">{t("staffMisc.front.calendar.fieldStatus")}</label>
                <select id="stf-f-status" className="stf-select" value={form.status} onChange={(event) => patchForm({ status: event.target.value })}>
                  {SETTABLE_STATUSES.map((value) => (
                    <option key={value} value={value}>{statusLabel(value)}</option>
                  ))}
                </select>
              </div>
            )}
            {form.error && <p className="stf-err" role="alert">{form.error}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="stf-btn" onClick={() => setForm(null)}>{t("common.cancel")}</button>
              <button type="submit" className="stf-btn pr" disabled={form.busy}>
                {form.busy ? t("common.loading") : t(form.type === "meeting" ? "staffMisc.front.calendar.addMeeting" : "staffMisc.front.calendar.addTask")}
              </button>
            </div>
          </form>
        )}
      </AppModal>

      {/* Meeting / milestone details */}
      <AppModal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? detail.title : ""} size="sm">
        {detail && (
          <div className="stf stf-form">
            <div className="stf-row" style={{ border: 0, padding: 0 }}>
              <span className="stf-tag o">{t(`staffMisc.front.calendar.kind.${detail.kind}`)}</span>
              {detail.status && <span className="stf-tag">{detail.status}</span>}
            </div>
            <p className="stf-sub" style={{ margin: 0 }}>
              {parseKey(detail.key).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {!detail.allDay && ` · ${timeLabel(detail.start)} – ${timeLabel(detail.end)}`}
            </p>
            {detail.place && <p className="stf-sub" style={{ margin: 0 }}>{detail.place}</p>}
            {detail.raw?.description && <p className="stf-sub" style={{ margin: 0 }}>{detail.raw.description}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              {detail.source === "program" && (
                <button type="button" className="stf-btn" onClick={() => router.push(`/pm/programs/${detail.relatedId}`)}>
                  {t("staffMisc.front.calendar.openProgram")}
                </button>
              )}
              <button type="button" className="stf-btn pr" onClick={() => setDetail(null)}>{t("common.close")}</button>
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );
}
