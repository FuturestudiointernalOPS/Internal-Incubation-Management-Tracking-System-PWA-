"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";

/**
 * The sessions already booked on a milestone, as the Venture sees them,
 * with their memo.
 *
 * Moved verbatim out of JourneyPlaybookTabs: every prop carries the tab
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The tab keeps all state and all writes.
 */
export default function FounderMilestoneSessions({
  milestone,
  noteDraft,
  noteEditFor,
  noteSaving,
  saveSessionNote,
  sessionsByMilestone,
  setNoteDraft,
  setNoteEditFor,
}) {
  const { lang, t } = useI18n();
  return (
    <div className="space-y-1 pt-1">
      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.milestoneSessions', { n: (sessionsByMilestone[String(milestone.id)] || []).length })}</p>
      {(sessionsByMilestone[String(milestone.id)] || []).map((session) => (
        <div key={session.id} className="space-y-0.5">
          <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{new Date(session.start_time).toLocaleString(lang || undefined)}</span>
            {' · '}{session.title}
            {session.coach_name ? ` · ${session.coach_name}` : ''}
            {(session.materials || []).map((material, index) =>
              material.url ? (
                <a key={`${material.name}-${index}`} href={material.url} target="_blank" rel="noreferrer" className="ml-2 font-bold" style={{ color: 'var(--brand-orange)' }}>{material.name}</a>
              ) : (
                <span key={`${material.name}-${index}`} className="ml-2">{material.name}</span>
              ),
            )}
          </div>
          {/* The session's ONE note — shown here and edited in
              place, never appended to. */}
          {noteEditFor === session.id ? (
            <div className="space-y-1">
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-[11px] text-[var(--text-primary)]"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setNoteEditFor(null); setNoteDraft(""); }} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border" style={{ borderColor: 'rgb(255 255 255 / 0.15)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
                <button type="button" disabled={noteSaving || !noteDraft.trim()} onClick={() => saveSessionNote(session.id)} className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg text-black disabled:opacity-50" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('common.save')}</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              {session.description && (
                <p className="flex-1 min-w-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-black uppercase tracking-widest mr-1.5">{t('venture.manager.memoLabel')}</span>
                  <span className="whitespace-pre-wrap">{session.description}</span>
                </p>
              )}
              <button type="button" onClick={() => { setNoteEditFor(session.id); setNoteDraft(session.description || ""); }} className="shrink-0 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--brand-orange)' }}>
                {t('venture.manager.editMemo')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
