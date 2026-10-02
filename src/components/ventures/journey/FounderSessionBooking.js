"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { SESSION_MATERIALS_MAX, toDateInput } from "@/lib/ventureSessionRules";
import { CalendarPlus, Loader2, X } from "lucide-react";

/**
 * The Venture books its own session — strictly against the one current
 * milestone of the active journey (date + exact time, materials).
 *
 * Moved verbatim out of JourneyPlaybookTabs: every prop carries the tab
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The tab keeps all state and all writes.
 */
export default function FounderSessionBooking({
  bookFor,
  bookForm,
  bookSaving,
  bookSession,
  milestone,
  openBooking,
  setBookFor,
  setBookForm,
  stage,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-1.5 pt-1">
      {bookFor === milestone.id ? (
        <form onSubmit={(event) => bookSession(event, stage, milestone)} className="rounded-lg border p-2.5 space-y-2" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--brand-orange)' }}>
            <CalendarPlus size={13} /> {t('venture.manager.bookSession')}
          </p>
          <textarea
            value={bookForm.note}
            onChange={(event) => setBookForm({ ...bookForm, note: event.target.value })}
            rows={3}
            required
            placeholder={t('venture.manager.memoPlaceholder')}
            className="w-full px-2.5 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" required min={toDateInput(new Date())} value={bookForm.date} onChange={(event) => setBookForm({ ...bookForm, date: event.target.value })} className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]" />
            <input type="time" required min={bookForm.min_time || undefined} value={bookForm.time} onChange={(event) => setBookForm({ ...bookForm, time: event.target.value })} className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]" />
            <select value={bookForm.duration} onChange={(event) => setBookForm({ ...bookForm, duration: event.target.value })} className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]">
              {["30", "45", "60", "90"].map((durationOption) => (
                <option key={durationOption} value={durationOption}>{t('venture.manager.minutes', { n: durationOption })}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.sessionMaterials')}</p>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={(event) => setBookForm({ ...bookForm, files: Array.from(event.target.files || []).slice(0, SESSION_MATERIALS_MAX) })}
              className="w-full text-[10px]"
              style={{ color: 'var(--text-secondary)' }}
            />
            {(bookForm.files || []).length > 0 && (
              <ul className="space-y-0.5">
                {bookForm.files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="truncate">{file.name}</span>
                    <button type="button" aria-label={t('venture.manager.sessionMaterialsRemove')} onClick={() => setBookForm({ ...bookForm, files: bookForm.files.filter((_, fileIndex) => fileIndex !== index) })} className="shrink-0">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.sessionMaterialsHint')}</p>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{t('venture.manager.sessionLeadHint')}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBookFor(null)} className="px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest" style={{ borderColor: 'rgb(255 255 255 / 0.15)', color: 'var(--text-secondary)' }}>{t('common.cancel')}</button>
            <button type="submit" disabled={bookSaving} className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-black flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: 'var(--brand-orange)' }}>
              {bookSaving ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />} {t('venture.manager.bookSession')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => openBooking(milestone)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--brand-orange)' }}>
          <CalendarPlus size={12} /> {t('venture.manager.bookSession')}
        </button>
      )}
    </div>
  );
}
