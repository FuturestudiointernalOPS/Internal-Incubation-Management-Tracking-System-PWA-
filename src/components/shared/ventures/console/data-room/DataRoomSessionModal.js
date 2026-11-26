"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Loader2, X } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { isValidSessionStart, minSessionStartInput, toDateInput, toTimeInput } from "@/lib/ventureSessionRules";
import { Overlay, Field } from "./DataRoomUploadModal";
import { documentTitle } from "./dataRoomUi";

const EMPTY = [];

// The milestone choices a session may be anchored to (a session always belongs
// to a milestone). The journey read nests them inside stages, so they are
// flattened here with the stage each belongs to.
const pickMilestones = (payload) => {
  if (!payload?.success) return EMPTY;
  const flat = [];
  for (const stage of payload.stages || []) {
    for (const milestone of stage.milestones || []) {
      flat.push({ id: String(milestone.id), title: milestone.title || "", stageId: stage.id, stage: stage.name || "" });
    }
  }
  return flat;
};

/**
 * Book a session to talk through a document that is not approved. The session is
 * the Venture's ordinary one (same endpoint, same rules); this dialog only fills
 * it in from the document: its title and the reason it was refused.
 */
export default function DataRoomSessionModal({ documentEntry, ventureId, t, onClose, onDone }) {
  const min = minSessionStartInput();
  const [form, setForm] = useState(() => ({
    milestone_id: "",
    date: toDateInput(min),
    time: toTimeInput(min),
    duration: "45",
    note: `${documentTitle(documentEntry)}${documentEntry?.review_notes ? `\n\n${documentEntry.review_notes}` : ""}`,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const { data: milestones, loading } = useApi(
    ventureId ? `/api/ventures/${ventureId}/journey` : null,
    { defaultValue: EMPTY, transform: pickMilestones, deps: [ventureId] },
  );
  const chosen = useMemo(() => milestones.find((entry) => entry.id === form.milestone_id), [milestones, form.milestone_id]);

  const submit = async (event) => {
    event.preventDefault();
    if (!chosen) return;
    const start = new Date(`${form.date}T${form.time}:00`);
    if (!isValidSessionStart(start)) {
      setError(t("venture.manager.sessionTooSoon"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session",
          title: documentTitle(documentEntry),
          description: form.note.trim(),
          session_type: "coaching",
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + (Number(form.duration) || 45) * 60000).toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          venture_facing: true,
          journey_stage_id: chosen.stageId,
          milestone_ref: chosen.id,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || t("dataRoom.errors.saveFailed"));
      onDone?.();
      onClose?.();
    } catch (caught) {
      setError(caught?.message || t("dataRoom.errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none";

  return (
    <Overlay onClose={onClose} label={t("dataRoom.session.title")}>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
            <CalendarPlus size={15} className="text-[var(--brand-orange)]" /> {t("dataRoom.session.title")}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] font-bold text-[var(--text-primary)] break-words">{documentTitle(documentEntry)}</p>

        <Field label={t("dataRoom.session.milestone")}>
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : milestones.length === 0 ? (
            <p className="text-[11px] text-amber-400">{t("dataRoom.session.noMilestone")}</p>
          ) : (
            <select value={form.milestone_id} onChange={(event) => setForm({ ...form, milestone_id: event.target.value })} required className={inputClass}>
              <option value="">{t("dataRoom.session.milestonePlaceholder")}</option>
              {milestones.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.stage ? `${entry.stage} — ${entry.title}` : entry.title}</option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label={t("dataRoom.session.date")}>
            <input type="date" value={form.date} min={toDateInput(min)} onChange={(event) => setForm({ ...form, date: event.target.value })} required className={inputClass} />
          </Field>
          <Field label={t("dataRoom.session.time")}>
            <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required className={inputClass} />
          </Field>
          <Field label={t("dataRoom.session.duration")}>
            <input type="number" min="15" step="15" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} className={inputClass} />
          </Field>
        </div>

        <Field label={t("dataRoom.session.note")}>
          <textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} rows={4} required className={`${inputClass} resize-none`} />
        </Field>

        {error ? <p className="text-[10px] text-rose-400 break-words">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="stf-btn sm">{t("common.cancel")}</button>
          <button type="submit" disabled={busy || !chosen || !form.note.trim()} className="stf-btn sm pr">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />} {t("dataRoom.session.book")}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
