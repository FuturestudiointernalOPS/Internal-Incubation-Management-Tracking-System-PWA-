"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Search, Video } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";
import AppCard from "./AppCard";
import AppButton from "./AppButton";
import AppInput from "./AppInput";
import AppSelect from "./AppSelect";
import AppModal from "./AppModal";
import { useDialogs } from "./DialogProvider";

const STATUSES = ["pending", "in_progress", "blocked", "completed", "carried_over"];
const STATUS_COLORS = {
  pending: "var(--participant-pending)", in_progress: "var(--chart-info)",
  blocked: "var(--chart-danger)", completed: "var(--chart-success)", carried_over: "var(--chart-warning)",
};
export function calendarDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function calendarRange(anchor, view) {
  const date = new Date(anchor); date.setHours(0, 0, 0, 0);
  if (view === "day") return [date];
  if (view === "month") date.setDate(1);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const count = view === "month" ? 42 : 7;
  return Array.from({ length: count }, (_, index) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + index));
}
const minutes = (time = "09:00") => { const [h, m] = (time || "09:00").split(":").map(Number); return h * 60 + m; };

// Partition overlapping appointments into lanes so every item stays reachable.
export function placeCalendarItems(items) {
  const ordered = items.map(item => ({ item, start: minutes(item.time), end: minutes(item.end || "") })).map(row => ({ ...row, end: Number.isFinite(row.end) && row.end > row.start ? row.end : row.start + 60 })).sort((a, b) => a.start - b.start || a.end - b.end);
  let group = [], end = 0;
  const flush = () => { const lanes = Math.max(1, ...group.map(row => row.lane + 1)); group.forEach(row => { row.lanes = lanes; }); };
  for (const row of ordered) {
    if (group.length && row.start >= end) { flush(); group = []; end = 0; }
    row.lane = 0;
    while (group.some(other => other.lane === row.lane && other.end > row.start)) row.lane++;
    group.push(row); end = Math.max(end, row.end);
  }
  flush(); return ordered;
}
function normalizeEvent(event) {
  const kind = ["session", "event", "venture_session"].includes(event.type) ? "meeting" : "task";
  const status = event.status === "approved" || event.status === "completed" ? "completed" : event.type === "submission" ? "in_progress" : "pending";
  return { ...event, id: `official:${event.id}`, date: String(event.date).slice(0, 10), time: event.time?.slice(0, 5) || null, kind, status, local: false };
}

export default function ParticipantCommandCalendar({ events = [], addRequest }) {
  const { t, lang } = useI18n();
  const { confirm } = useDialogs();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const [anchor, setAnchor] = useState(now);
  const [view, setView] = useState("month");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [types, setTypes] = useState({ task: true, meeting: true });
  const [personal, setPersonal] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const days = calendarRange(anchor, view);
  const items = [...events.filter(event => event.date).map(normalizeEvent), ...personal];
  const searchMatches = item => [item.title, item.description, item.place].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const visible = items.filter(item => types[item.kind] && searchMatches(item) && (item.kind === "meeting" || status === "all" || item.status === status));
  const inRange = items.filter(item => days.some(day => calendarDateKey(day) === item.date) && searchMatches(item));
  const openAdd = (kind = "task", date = anchor) => { setError(""); setForm({ kind, title: "", date: calendarDateKey(date), time: "09:00", end: "10:00", status: "pending", place: "" }); };
  // A declarative signal from the welcome banner; the calendar owns its form.
  const addSignal = addRequest;
  const [handledSignal, setHandledSignal] = useState(addSignal);
  if (addSignal !== handledSignal) {
    setHandledSignal(addSignal);
    if (addSignal) setForm({ kind: "task", title: "", date: calendarDateKey(now), time: "09:00", end: "10:00", status: "pending", place: "" });
  }
  const navigate = direction => {
    const date = new Date(anchor);
    if (view === "month") { date.setDate(1); date.setMonth(date.getMonth() + direction); }
    else date.setDate(date.getDate() + direction * (view === "week" ? 7 : 1));
    setAnchor(date);
  };
  const save = event => {
    event.preventDefault();
    if (!form.title.trim() || !form.date || !form.time || !form.end) { setError(t("participant.template.calendar.required")); return; }
    if (minutes(form.end) <= minutes(form.time)) { setError(t("participant.template.calendar.endAfterStart")); return; }
    setPersonal(previous => [...previous, { ...form, title: form.title.trim(), id: `personal:${crypto.randomUUID()}`, local: true }]);
    setAnchor(new Date(`${form.date}T00:00:00`)); setTypes(previous => ({ ...previous, [form.kind]: true })); setStatus("all"); setForm(null);
  };
  const toggleType = kind => setTypes(previous => {
    const next = { ...previous, [kind]: !previous[kind] };
    if (!next.task && !next.meeting) next[kind === "task" ? "meeting" : "task"] = true;
    return next;
  });
  const itemButton = item => <button type="button" onClick={() => setSelected(item)} className={`w-full text-left rounded-md px-2 py-1 text-xs flex items-center gap-1.5 ${item.kind === "meeting" ? "bg-brand-orange/10 text-[var(--brand-orange)]" : "text-[var(--text-primary)] hover:bg-surface-2"}`} title={item.title}>
    {item.kind === "meeting" ? <Video className="h-3 w-3 shrink-0" /> : <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[item.status] }} />}
    <span className="truncate"><b>{item.time || t("participant.template.calendar.noTime")}</b> {item.title}</span>
  </button>;
  const dayItems = day => visible.filter(item => item.date === calendarDateKey(day));
  const timedRows = days.map(day => placeCalendarItems(dayItems(day).filter(item => item.time)));
  const startHour = Math.min(8, ...timedRows.flat().map(row => Math.floor(row.start / 60)));
  const endHour = Math.min(24, Math.max(18, ...timedRows.flat().map(row => Math.ceil(row.end / 60))));
  return <AppCard className="participant-calendar min-w-0">
    <div className="flex flex-wrap items-end gap-2 mb-4">
      <div className="w-44"><AppSelect label={t("participant.template.calendar.statusFilter")} disabled={!types.task} value={status} onChange={event => setStatus(event.target.value)} options={[{ value: "all", label: t("participant.template.calendar.all") }, ...STATUSES.map(value => ({ value, label: t(`participant.template.calendar.statuses.${value}`) }))]} /></div>
      {["task", "meeting"].map(kind => <AppButton key={kind} size="sm" variant={types[kind] ? "secondary" : "ghost"} aria-pressed={types[kind]} onClick={() => toggleType(kind)}>{t(`participant.template.calendar.${kind}s`)} ({inRange.filter(item => item.kind === kind).length})</AppButton>)}
      <div className="flex-1 min-w-40"><AppInput type="search" icon={Search} label={t("common.search")} value={query} onChange={event => setQuery(event.target.value)} /></div>
      <AppButton size="sm" icon={Plus} onClick={() => openAdd()}>{t("participant.template.calendar.add")}</AppButton>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2"><h2 className="text-lg font-medium text-[var(--text-primary)]">{formatLocaleDate(anchor, { month: "long", year: "numeric" }, lang)}</h2><button type="button" aria-label={t("participant.template.calendar.previous")} onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></button><AppButton size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>{t("time.today")}</AppButton><button type="button" aria-label={t("participant.template.calendar.next")} onClick={() => navigate(1)} className="p-2 rounded-full hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></button></div>
      <div className="inline-flex rounded-xl bg-surface-2 p-1">{["day", "week", "month"].map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-lg px-3 py-1.5 text-xs ${view === value ? "bg-surface-1 font-bold" : "text-[var(--text-secondary)]"}`}>{t(`participant.template.calendar.views.${value}`)}</button>)}</div>
    </div>
    {view === "month" ? <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-[var(--border-primary)] bg-[var(--border-primary)]">
      {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => <div key={day} className="bg-surface-2 py-2 text-center text-[10px] font-bold text-[var(--text-secondary)]">{t(`time.days.${day}`)}</div>)}
      {days.map(day => <div key={calendarDateKey(day)} className="min-h-24 min-w-0 bg-surface-1 p-1 space-y-1"><button type="button" aria-label={formatLocaleDate(day, { day: "numeric", month: "long", year: "numeric" }, lang)} onClick={() => { setAnchor(day); setView("day"); }} className={`mx-auto block rounded-full px-2 py-0.5 text-xs ${calendarDateKey(day) === calendarDateKey(now) ? "bg-[var(--brand-orange)] font-bold" : day.getMonth() !== anchor.getMonth() ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>{day.getDate()}</button>{dayItems(day).slice(0, 3).map(item => <div key={item.id}>{itemButton(item)}</div>)}{dayItems(day).length > 3 && <button type="button" className="text-[10px] text-[var(--text-secondary)]" onClick={() => { setAnchor(day); setView("day"); }}>{t("participant.template.calendar.more", { count: dayItems(day).length - 3 })}</button>}</div>)}
    </div> : <div className="max-h-[460px] overflow-auto rounded-xl border border-[var(--border-primary)]">
      <div style={{ minWidth: view === "week" ? 760 : undefined }}>
        <div className="sticky top-0 z-10 grid bg-surface-2 border-b border-[var(--border-primary)]" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}><div />{days.map(day => <button key={calendarDateKey(day)} type="button" onClick={() => { setAnchor(day); setView("day"); }} className="p-2 text-center text-xs text-[var(--text-secondary)]">{formatLocaleDate(day, { weekday: "short", day: "numeric" }, lang)}</button>)}</div>
        {days.some(day => dayItems(day).some(item => !item.time)) && <div className="grid border-b border-[var(--border-primary)] bg-surface-2" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}><span className="p-1 text-[10px] text-[var(--text-tertiary)]">{t("participant.template.calendar.noTime")}</span>{days.map(day => <div key={calendarDateKey(day)} className="min-w-0 border-l border-[var(--border-primary)] p-1">{dayItems(day).filter(item => !item.time).map(item => <div key={item.id}>{itemButton(item)}</div>)}</div>)}</div>}
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: (endHour - startHour) * 60 }}>{Array.from({ length: endHour - startHour }, (_, index) => <span key={index} className="absolute right-1 text-[10px] text-[var(--text-tertiary)]" style={{ top: index * 60 }}>{String(startHour + index).padStart(2, "0")}:00</span>)}</div>
          {days.map((day, index) => <div key={calendarDateKey(day)} className="relative border-l border-[var(--border-primary)]" style={{ height: (endHour - startHour) * 60, backgroundImage: "linear-gradient(var(--border-primary) 1px, transparent 1px)", backgroundSize: "100% 60px" }}>{calendarDateKey(day) === calendarDateKey(now) && now.getHours() >= startHour && now.getHours() < endHour && <div className="pointer-events-none absolute left-0 right-0 z-[2] border-t-2 border-[var(--chart-danger)]" style={{ top: now.getHours() * 60 + now.getMinutes() - startHour * 60 }} />}{timedRows[index].map(row => <div key={row.item.id} className="absolute overflow-auto rounded-lg border border-[var(--border-primary)] bg-surface-1" style={{ top: row.start - startHour * 60, height: Math.max(30, row.end - row.start - 2), left: `calc(${row.lane / row.lanes * 100}% + 2px)`, width: `calc(${100 / row.lanes}% - 4px)` }}>{itemButton(row.item)}</div>)}</div>)}
        </div>
      </div>
    </div>}
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--border-primary)] pt-3">{STATUSES.map(value => <span key={value} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLORS[value] }} />{t(`participant.template.calendar.statuses.${value}`)}</span>)}</div>
    <AppModal isOpen={Boolean(form)} onClose={() => setForm(null)} title={t(`participant.template.calendar.new${form?.kind === "meeting" ? "Meeting" : "Task"}`)}>
      {form && <form onSubmit={save} className="space-y-4">
        <div className="flex gap-2">{["task", "meeting"].map(kind => <AppButton key={kind} variant={form.kind === kind ? "secondary" : "ghost"} onClick={() => setForm(previous => ({ ...previous, kind }))}>{t(`participant.template.calendar.${kind}`)}</AppButton>)}</div>
        <AppInput label={t("participant.template.calendar.title")} required maxLength={120} value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} />
        <AppInput label={t("participant.template.calendar.date")} type="date" required value={form.date} onChange={event => setForm(previous => ({ ...previous, date: event.target.value }))} />
        <div className="grid grid-cols-2 gap-3">{["time", "end"].map(key => <AppInput key={key} label={t(`participant.template.calendar.${key}`)} type="time" required value={form[key]} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} />)}</div>
        {form.kind === "meeting" ? <AppInput label={t("participant.template.calendar.place")} value={form.place} onChange={event => setForm(previous => ({ ...previous, place: event.target.value }))} /> : <AppSelect label={t("participant.template.calendar.statusFilter")} value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value }))} options={STATUSES.map(value => ({ value, label: t(`participant.template.calendar.statuses.${value}`) }))} />}
        <p className="text-xs text-[var(--text-secondary)]">{t("participant.template.calendar.localNote")}</p>
        {error && <p role="alert" className="text-sm text-[var(--chart-danger)]">{error}</p>}
        <div className="flex justify-end gap-2"><AppButton variant="secondary" onClick={() => setForm(null)}>{t("common.cancel")}</AppButton><AppButton type="submit">{t("participant.template.calendar.add")}</AppButton></div>
      </form>}
    </AppModal>
    <AppModal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title}>
      {selected && <div className="space-y-4"><p className="text-sm text-[var(--text-secondary)]">{selected.date} · {selected.time}{selected.end ? ` – ${selected.end}` : ""}</p><p className="text-sm text-[var(--text-secondary)]">{selected.description || selected.place}</p>{selected.local ? <>
        {selected.kind === "task" && <AppSelect label={t("participant.template.calendar.statusFilter")} value={selected.status} onChange={event => { const next = { ...selected, status: event.target.value }; setPersonal(previous => previous.map(item => item.id === next.id ? next : item)); setSelected(next); }} options={STATUSES.map(value => ({ value, label: t(`participant.template.calendar.statuses.${value}`) }))} />}
        <AppButton variant="danger" onClick={async () => { if (await confirm({ message: t("participant.template.calendar.deleteConfirm"), tone: "danger" })) { setPersonal(previous => previous.filter(item => item.id !== selected.id)); setSelected(null); } }}>{t("common.delete")}</AppButton>
      </> : <Link className="text-sm font-bold text-[var(--brand-orange)]" href={selected.programId ? `/participant/${selected.programId}` : "/participant/assignments"}>{t("participant.template.calendar.openDetails")}</Link>}</div>}
    </AppModal>
  </AppCard>;
}
