"use client";

import { useState } from "react";
import AppButton from "@/components/ui/AppButton";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

const EMPTY_NOTES = [];
const pickNotes = (payload) => payload?.success && Array.isArray(payload.notes) ? payload.notes : EMPTY_NOTES;

export default function PrivateVentureNotes({ ventureId }) {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data: notes, loading, error, refresh } = useApi(
    `/api/investor/private-notes?venture_id=${encodeURIComponent(ventureId)}`,
    { defaultValue: EMPTY_NOTES, transform: pickNotes },
  );

  const save = async (event) => {
    event.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/investor/private-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture_id: ventureId, content }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "errors.somethingWrong");
      }
      setContent("");
      refresh();
    } catch (saveError) {
      setMessage(t(saveError.message || "errors.somethingWrong"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-[var(--border-primary)] pt-4" aria-labelledby="investor-private-notes-title">
      <h4 id="investor-private-notes-title" className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
        {t("dashboardV2.privateNotes")}
      </h4>
      <form className="space-y-2" onSubmit={save}>
        <label className="sr-only" htmlFor="investor-private-note">{t("dashboardV2.privateNoteLabel")}</label>
        <textarea
          id="investor-private-note"
          value={content}
          maxLength={4000}
          onChange={(event) => setContent(event.target.value)}
          className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text-primary)]"
          placeholder={t("dashboardV2.privateNotePlaceholder")}
          rows={3}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="stf-small">{content.length}/4000</span>
          <AppButton size="sm" type="submit" disabled={!content.trim() || saving} loading={saving}>
            {t("dashboardV2.saveNote")}
          </AppButton>
        </div>
      </form>
      {message && <p className="stf-small text-rose-500" role="alert">{message}</p>}
      {error && notes.length === 0 && <p className="stf-small" role="status">{t("dashboardV2.notesUnavailable")}</p>}
      {loading && notes.length === 0 && <p className="stf-small" aria-live="polite">{t("common.loading")}</p>}
      {notes.map((note) => (
        <article className="rounded-lg bg-[var(--surface-2)] p-3" key={note.id}>
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]">{note.content}</p>
          {note.created_at && <time className="stf-small mt-2 block" dateTime={note.created_at}>
            {new Date(note.created_at).toLocaleDateString()}
          </time>}
        </article>
      ))}
    </section>
  );
}
