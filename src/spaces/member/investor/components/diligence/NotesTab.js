"use client";

import { Send, MessageSquare } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

/**
 * The Notes tab: the note composer and the note list.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function NotesTab({
  notes,
  newNote,
  setNewNote,
  noteType,
  setNoteType,
  addNote,
}) {
  return (
    <div className="space-y-4">
      <AppCard padding="md">
        <div className="space-y-3">
          <textarea value={newNote} onChange={event => setNewNote(event.target.value)}
            rows={2} placeholder="Write an investment note..."
            className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none" />
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {["private", "shared", "advisor", "decision"].map(noteTypeOption => (
                <button key={noteTypeOption} onClick={() => setNoteType(noteTypeOption)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${noteType === noteTypeOption ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>
                  {noteTypeOption}
                </button>
              ))}
            </div>
            <AppButton variant="primary" size="sm" icon={Send} onClick={addNote}>Save</AppButton>
          </div>
        </div>
      </AppCard>

      {notes.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-sm font-bold text-[var(--text-secondary)]">No notes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <AppCard key={note.id} padding="md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      note.note_type === "private" ? "bg-slate-500/10 text-slate-400" :
                      note.note_type === "shared" ? "bg-blue-500/10 text-blue-400" :
                      note.note_type === "advisor" ? "bg-purple-500/10 text-purple-400" : "bg-brand-orange/10 text-[var(--brand-orange)]"
                    }`}>{note.note_type}</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)]">{note.content}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-2">{new Date(note.created_at).toLocaleString()}</p>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}
    </div>
  );
}
