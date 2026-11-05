"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, Pause, Play, Plus, Square, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import { useDialogs } from "@/components/ui/DialogProvider";

/**
 * RECURRING MEETING SCHEDULE — P1 panel (planning only).
 *
 * What this panel does: define a pattern, PREVIEW what it would produce, save it
 * as a draft, pause/resume/end it, and replace it from a date (a new version).
 *
 * What it deliberately does NOT do: create sessions, invite anyone, notify
 * anyone or touch a calendar. That is P2 and needs its own approval.
 *
 * The preview is the point of the phase: a recurring pattern that books before a
 * manager has seen it is the one mistake this feature cannot take back.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptySlot = (weekday = 2) => ({ weekday, start: "16:00", minutes: 30 });

const defaultForm = () => ({
  title: "",
  description: "",
  session_type: "coaching",
  timezone: "Africa/Porto-Novo",
  frequency: "weekly",
  interval_count: 1,
  // The example from the brief: Tuesday 16:00–16:30 and Friday 15:00–15:30.
  slots: [
    { weekday: 2, start: "16:00", minutes: 30 },
    { weekday: 5, start: "15:00", minutes: 30 },
  ],
  valid_from: todayISO(),
  valid_until: "",
  max_occurrences: "",
});

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const FREQUENCIES = ["weekly", "biweekly", "daily", "monthly"];
const TYPES = ["coaching", "mentorship", "progress_review", "pitch_review", "technical"];

/** "16:00" + 30 → "16:30" (display only; the server owns the real maths). */
function endOfSlot(slot) {
  if (!TIME_RE.test(String(slot.start || ""))) return "";
  const [hours, minutes] = slot.start.split(":").map(Number);
  const total = (hours * 60 + minutes + Number(slot.minutes || 0)) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formFromSchedule(schedule) {
  return {
    title: schedule.title || "",
    description: schedule.description || "",
    session_type: schedule.sessionType || "coaching",
    timezone: schedule.timezone || "Africa/Porto-Novo",
    frequency: schedule.frequency || "weekly",
    interval_count: schedule.intervalCount || 1,
    slots: (schedule.slots || []).map((slot) => ({ weekday: slot.weekday, start: slot.start, minutes: slot.minutes })),
    valid_from: schedule.validFrom || todayISO(),
    valid_until: schedule.validUntil || "",
    max_occurrences: schedule.maxOccurrences ? String(schedule.maxOccurrences) : "",
  };
}

export default function RecurringSchedulePanel({ ventureId }) {
  const { t, lang } = useI18n();
  const { confirm } = useDialogs();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState({ action: "create", scheduleId: null });
  const [form, setForm] = useState(defaultForm);
  const [preview, setPreview] = useState(null);

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/session-schedules`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(base);
      const payload = await response.json().catch(() => ({}));
      if (payload.success) setSchedules(payload.schedules || []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (body) => {
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: response.ok, payload: await response.json().catch(() => ({})) };
  };

  const patchForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const patchSlot = (index, patch) =>
    setForm((current) => ({
      ...current,
      slots: current.slots.map((slot, at) => (at === index ? { ...slot, ...patch } : slot)),
    }));

  const addSlot = () => setForm((current) => ({ ...current, slots: [...current.slots, emptySlot(4)] }));

  const removeSlot = (index) =>
    setForm((current) => ({ ...current, slots: current.slots.filter((_slot, at) => at !== index) }));

  const runPreview = async () => {
    setBusy(true);
    setErrors([]);
    setNotice("");
    const result = await post({ action: "preview", schedule: form, limit: 12 });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      setPreview(null);
      return;
    }
    setPreview({ window: result.payload.window, occurrences: result.payload.occurrences || [] });
    setNotice(t("venture.schedule.previewOnly"));
  };

  const save = async () => {
    setBusy(true);
    setErrors([]);
    setNotice("");
    const isVersion = editing.action === "new_version";
    const result = await post(
      isVersion
        ? { action: "new_version", schedule_id: editing.scheduleId, schedule: form }
        : { action: "create", schedule: form },
    );
    setBusy(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setNotice(t("venture.schedule.saved"));
    setFormOpen(false);
    setEditing({ action: "create", scheduleId: null });
    setForm(defaultForm());
    setPreview(null);
    await load();
  };

  const changeStatus = async (schedule, action) => {
    setBusy(true);
    setErrors([]);
    const result = await post({ action, schedule_id: schedule.id });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    await load();
  };

  const endSchedule = async (schedule) => {
    if (!(await confirm({ message: t("venture.schedule.action.end"), tone: "danger" }))) return;
    setBusy(true);
    setErrors([]);
    const result = await post({ action: "end", schedule_id: schedule.id });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    await load();
  };

  const startNew = () => {
    setEditing({ action: "create", scheduleId: null });
    setForm(defaultForm());
    setPreview(null);
    setErrors([]);
    setNotice("");
    setFormOpen(true);
  };

  const startVersion = (schedule) => {
    setEditing({ action: "new_version", scheduleId: schedule.id });
    setForm(formFromSchedule(schedule));
    setPreview(null);
    setErrors([]);
    setNotice("");
    setFormOpen(true);
  };

  const weekdayName = (weekday) => t(`venture.schedule.weekday.${weekday}`);

  const summary = (schedule) => {
    const slots = (schedule.slots || [])
      .map((slot) => `${weekdayName(slot.weekday)} ${slot.start}–${endOfSlot(slot)}`)
      .join(" · ");
    return slots || "—";
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <CalendarClock className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
            {t("venture.schedule.title")}
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {t("venture.schedule.subtitle")}
          </p>
        </div>
        <button type="button" onClick={startNew} className="stf-btn sm pr shrink-0">
          <Plus size={13} /> {t("venture.schedule.new")}
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 text-xs text-rose-500">
          {errors.map((key) => <li key={key}>{t(key)}</li>)}
        </ul>
      )}
      {notice && <p className="text-xs font-bold text-emerald-600">{notice}</p>}

      {/* ── The form ───────────────────────────────────────────────────── */}
      {formOpen && (
        <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: "var(--border-primary)" }}>
          <div className="grid gap-3 md:grid-cols-2">
            <AppInput
              label={t("venture.schedule.field.title")}
              value={form.title}
              onChange={(event) => patchForm({ title: event.target.value })}
            />
            <AppSelect
              label={t("venture.schedule.field.type")}
              value={form.session_type}
              onChange={(event) => patchForm({ session_type: event.target.value })}
              options={TYPES.map((value) => ({ value, label: t(`venture.schedule.type.${value}`) }))}
            />
          </div>

          <AppInput
            label={t("venture.schedule.field.description")}
            value={form.description}
            onChange={(event) => patchForm({ description: event.target.value })}
          />

          <div className="grid gap-3 md:grid-cols-3">
            <AppSelect
              label={t("venture.schedule.field.frequency")}
              value={form.frequency}
              onChange={(event) => patchForm({ frequency: event.target.value })}
              options={FREQUENCIES.map((value) => ({ value, label: t(`venture.schedule.frequency.${value}`) }))}
            />
            <AppInput
              type="number"
              label={t("venture.schedule.field.interval")}
              value={form.interval_count}
              onChange={(event) => patchForm({ interval_count: event.target.value })}
            />
            <AppInput
              label={t("venture.schedule.field.timezone")}
              value={form.timezone}
              onChange={(event) => patchForm({ timezone: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {t("venture.schedule.field.slots")}
            </p>
            {form.slots.map((slot, index) => (
              <div key={index} className="grid gap-2 items-end" style={{ gridTemplateColumns: "1.4fr 1fr 1fr auto" }}>
                <AppSelect
                  label={index === 0 ? t("venture.schedule.field.weekday") : ""}
                  value={String(slot.weekday)}
                  onChange={(event) => patchSlot(index, { weekday: Number(event.target.value) })}
                  options={WEEKDAYS.map((value) => ({ value: String(value), label: weekdayName(value) }))}
                />
                <AppInput
                  label={index === 0 ? t("venture.schedule.field.start") : ""}
                  value={slot.start}
                  onChange={(event) => patchSlot(index, { start: event.target.value })}
                />
                <AppInput
                  type="number"
                  label={index === 0 ? t("venture.schedule.field.minutes") : ""}
                  value={slot.minutes}
                  onChange={(event) => patchSlot(index, { minutes: event.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeSlot(index)}
                  title={t("venture.schedule.field.removeSlot")}
                  aria-label={t("venture.schedule.field.removeSlot")}
                  className="mb-1 p-2 rounded-lg"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addSlot} className="stf-btn sm">
              <Plus size={13} /> {t("venture.schedule.field.addSlot")}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <AppInput
              label={t("venture.schedule.field.validFrom")}
              value={form.valid_from}
              onChange={(event) => patchForm({ valid_from: event.target.value })}
            />
            <AppInput
              label={t("venture.schedule.field.validUntil")}
              value={form.valid_until}
              onChange={(event) => patchForm({ valid_until: event.target.value })}
            />
            <AppInput
              type="number"
              label={t("venture.schedule.field.maxOccurrences")}
              value={form.max_occurrences}
              onChange={(event) => patchForm({ max_occurrences: event.target.value })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button type="button" onClick={() => { setFormOpen(false); setPreview(null); setErrors([]); }} className="stf-btn sm">
              {t("venture.schedule.cancel")}
            </button>
            <button type="button" onClick={runPreview} disabled={busy} className="stf-btn sm">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
              {t("venture.schedule.previewButton")}
            </button>
            <button type="button" onClick={save} disabled={busy} className="stf-btn sm pr">
              {t("venture.schedule.save")}
            </button>
          </div>
        </div>
      )}

      {/* ── The preview ────────────────────────────────────────────────── */}
      {preview && (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "var(--border-primary)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
              {t("venture.schedule.preview.title")}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              {t("venture.schedule.window", { from: preview.window.from, to: preview.window.to })} ·{" "}
              {t("venture.schedule.occurrenceCount", { count: preview.occurrences.length })}
            </p>
          </div>
          {preview.occurrences.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{t("venture.schedule.noOccurrences")}</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border-primary)" }}>
              {preview.occurrences.map((occurrence) => (
                <li key={occurrence.occurrenceKey} className="py-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                    {new Date(`${occurrence.date}T00:00:00Z`).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {t("venture.schedule.preview.local", { start: occurrence.startLocal, end: occurrence.endLocal })}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {t("venture.schedule.preview.utc", { time: occurrence.startUtc.slice(11, 16) })}
                  </span>
                  <span className="ml-auto text-[9px] uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                    {occurrence.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Existing schedules ─────────────────────────────────────────── */}
      {loading ? (
        <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" style={{ color: "var(--text-tertiary)" }} /></div>
      ) : schedules.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{t("venture.schedule.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {schedules.map((schedule) => {
            const ended = schedule.status === "ended";
            return (
              <li key={schedule.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--border-primary)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{schedule.title}</p>
                  <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>
                    {t(`venture.schedule.status.${schedule.status}`)}
                  </span>
                  <span className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                    {t("venture.schedule.version", { n: schedule.version })}
                  </span>
                  <span className="ml-auto text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {t(`venture.schedule.frequency.${schedule.frequency}`)} · {summary(schedule)}
                  </span>
                </div>

                {schedule.next?.length > 0 && (
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {schedule.next.map((occurrence) => `${occurrence.date} ${occurrence.startLocal}–${occurrence.endLocal}`).join(" · ")}
                  </p>
                )}

                {!ended && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button type="button" onClick={() => startVersion(schedule)} className="stf-btn sm">
                      {t("venture.schedule.action.newVersion")}
                    </button>
                    <button
                      type="button"
                      onClick={() => changeStatus(schedule, schedule.status === "paused" ? "resume" : "pause")}
                      disabled={busy}
                      className="stf-btn sm"
                    >
                      {schedule.status === "paused" ? <Play size={12} /> : <Pause size={12} />}
                      {schedule.status === "paused" ? t("venture.schedule.action.resume") : t("venture.schedule.action.pause")}
                    </button>
                    <button type="button" onClick={() => endSchedule(schedule)} disabled={busy} className="stf-btn sm rj">
                      <Square size={12} /> {t("venture.schedule.action.end")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
