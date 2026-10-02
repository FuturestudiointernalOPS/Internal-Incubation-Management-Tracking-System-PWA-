"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";

/**
 * The sessions already booked on a milestone (the milestone stays the home of
 * its sessions), each with its ONE memo — shown here and edited in place, never
 * appended to. The panel keeps the state and the save; this only renders.
 *
 * Props:
 *   sessions          – the milestone's sessions (cancelled ones already left out)
 *   deliverables      – the milestone's deliverables, to name the one a session is about
 *   statusKey         – status → i18n key of the session status
 *   noteEditFor       – id of the session whose memo is being edited, or null
 *   noteDraft         – the memo being edited
 *   onNoteDraftChange – (text) => void
 *   noteSaving        – a memo save is running
 *   onEditNote        – (session) => void, opens the memo editor
 *   onCancelNote      – () => void
 *   onSaveNote        – (sessionId) => void
 *   autoGrow          – textarea onInput handler that grows it with its content
 */
export default function MilestoneSessionsList({
  sessions,
  deliverables,
  statusKey,
  noteEditFor,
  noteDraft,
  onNoteDraftChange,
  noteSaving,
  onEditNote,
  onCancelNote,
  onSaveNote,
  autoGrow,
}) {
  const { t, lang } = useI18n();
  return (
    <div className="mt-2 ml-5 space-y-1">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
        {t("venture.manager.milestoneSessions", { n: sessions.length })}
      </p>
      {sessions.map((session) => {
        const deliverable = deliverables.find((candidate) => String(candidate.id) === String(session.deliverable_id));
        return (
          <div key={session.id} className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-secondary)]">
            <span className="font-bold text-[var(--text-primary)]">{new Date(session.start_time).toLocaleString(lang || undefined)}</span>
            <span>{session.title}</span>
            {session.coach_name && <span>· {session.coach_name}</span>}
            {deliverable && <span>· {deliverable.title}</span>}
            <span className="uppercase tracking-widest">{t(statusKey(session.status))}</span>
            {(session.materials || []).length > 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                {(session.materials || []).map((material, index) =>
                  material.url ? (
                    <a
                      key={`${material.name}-${index}`}
                      href={material.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--brand-orange)] hover:underline"
                    >
                      {material.name}
                    </a>
                  ) : (
                    <span key={`${material.name}-${index}`} className="text-slate-500">{material.name}</span>
                  ),
                )}
              </span>
            )}
            </div>
            {/* The session's ONE note — shown here and edited
                in place, never appended to. */}
            {noteEditFor === session.id ? (
              <div className="space-y-1 pt-0.5">
                <textarea
                  value={noteDraft}
                  onChange={(event) => onNoteDraftChange(event.target.value)}
                  onInput={autoGrow}
                  rows={2}
                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-[11px] text-[var(--text-primary)] resize-none overflow-hidden min-h-[48px]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onCancelNote}
                    className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={noteSaving || !noteDraft.trim()}
                    onClick={() => onSaveNote(session.id)}
                    className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-[var(--brand-orange)] text-black disabled:opacity-50"
                  >
                    {t("common.save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                {session.description && (
                  <p className="flex-1 min-w-0 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    <span className="font-black uppercase tracking-widest mr-1.5">{t("venture.manager.memoLabel")}</span>
                    <span className="whitespace-pre-wrap">{session.description}</span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onEditNote(session)}
                  className="shrink-0 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]"
                >
                  {t("venture.manager.editMemo")}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
