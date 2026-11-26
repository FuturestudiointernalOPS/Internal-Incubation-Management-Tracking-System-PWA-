"use client";

import { formatLocaleDate } from "@/lib/constants";

/**
 * Notes tab — the add-note input and the note timeline. The note text and the
 * save handler are owned by the page.
 */
export default function NotesTab({
  noteText,
  onNoteTextChange,
  savingNote,
  onAddNote,
  events,
  t,
  lang,
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={t("crm.people.notePlaceholder")}
          value={noteText}
          onChange={event => onNoteTextChange(event.target.value)}
          onKeyDown={event => event.key === "Enter" && onAddNote()}
          className="flex-1 bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
        />
        <button
          onClick={onAddNote}
          disabled={savingNote || !noteText.trim()}
          className="px-4 py-2.5 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl disabled:opacity-50"
        >
          {savingNote ? "..." : t("crm.people.add")}
        </button>
      </div>
      <div className="space-y-2">
        {events.filter(event => event.event_type === "note_added").map(noteEvent => (
          <div key={noteEvent.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
            <p className="text-sm">{noteEvent.description}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {formatLocaleDate(noteEvent.created_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}
            </p>
          </div>
        ))}
        {events.filter(event => event.event_type === "note_added").length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] py-4">{t("crm.people.noNotes")}</p>
        )}
      </div>
    </div>
  );
}
