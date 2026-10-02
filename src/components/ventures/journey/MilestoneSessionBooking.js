"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { SESSION_MATERIALS_MAX, toDateInput } from "@/lib/ventureSessionRules";
import { CalendarPlus, Loader2, X } from "lucide-react";

/**
 * Book a session on a milestone (date + exact time, coach, deliverable,
 * materials).
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function MilestoneSessionBooking({
  autoGrow,
  bookFor,
  bookForm,
  bookSaving,
  bookSession,
  coachOptions,
  deliverableList,
  milestone,
  openBooking,
  setBookFor,
  setBookForm,
  stage,
}) {
  const { t } = useI18n();
  return (
    <div className="mt-2 ml-5">
      {bookFor === milestone.id ? (
        <form onSubmit={(event) => bookSession(event, stage, milestone)} className="rounded-lg border border-[var(--border-primary)] p-2.5 space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] flex items-center gap-1.5">
            <CalendarPlus className="w-3.5 h-3.5" /> {t("venture.manager.bookSession")}
          </p>
          <input
            value={bookForm.title}
            onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })}
            placeholder={t("venture.manager.sessionTitlePlaceholder")}
            className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
          />
          <textarea
            value={bookForm.note}
            onChange={(event) => setBookForm({ ...bookForm, note: event.target.value })}
            onInput={autoGrow}
            rows={3}
            required
            placeholder={t("venture.manager.memoPlaceholder")}
            className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)] resize-none overflow-hidden min-h-[72px]"
          />
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
              {t("venture.manager.sessionMaterials")}
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={(event) =>
                setBookForm({
                  ...bookForm,
                  files: Array.from(event.target.files || []).slice(0, SESSION_MATERIALS_MAX),
                })
              }
              className="w-full text-[10px] text-[var(--text-secondary)]"
            />
            {(bookForm.files || []).length > 0 && (
              <ul className="space-y-0.5">
                {bookForm.files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-[9px] text-[var(--text-secondary)]">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label={t("venture.manager.sessionMaterialsRemove")}
                      onClick={() =>
                        setBookForm({ ...bookForm, files: bookForm.files.filter((_, fileIndex) => fileIndex !== index) })
                      }
                      className="shrink-0 text-slate-500 hover:text-[var(--text-primary)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[9px] text-slate-500">{t("venture.manager.sessionMaterialsHint")}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
              {t("venture.manager.sessionDeliverable")}
            </p>
            <select
              value={bookForm.deliverable_id}
              onChange={(event) => setBookForm({ ...bookForm, deliverable_id: event.target.value })}
              className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            >
              <option value="">{t("venture.manager.sessionNoDeliverable")}</option>
              {deliverableList.map((deliverable) => (
                <option key={deliverable.id} value={deliverable.id}>{deliverable.title}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              required
              min={toDateInput(new Date())}
              value={bookForm.date}
              onChange={(event) => setBookForm({ ...bookForm, date: event.target.value })}
              className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            />
            <input
              type="time"
              required
              min={bookForm.min_time || undefined}
              value={bookForm.time}
              onChange={(event) => setBookForm({ ...bookForm, time: event.target.value })}
              className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            />
            <select
              value={bookForm.duration}
              onChange={(event) => setBookForm({ ...bookForm, duration: event.target.value })}
              className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            >
              {["30", "45", "60", "90"].map((durationOption) => (
                <option key={durationOption} value={durationOption}>{t("venture.manager.minutes", { n: durationOption })}</option>
              ))}
            </select>
            <select
              value={bookForm.coach_id}
              onChange={(event) => setBookForm({ ...bookForm, coach_id: event.target.value })}
              className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            >
              <option value="">{t("venture.manager.noCoach")}</option>
              {coachOptions.map((coach) => (
                <option key={coach.id || coach.coach_id} value={coach.coach_id}>{coach.full_name || coach.email}</option>
              ))}
            </select>
          </div>
          <p className="text-[9px] text-slate-500">{t("venture.manager.sessionLeadHint")}</p>
          <p className="text-[9px] text-slate-500">{t("venture.manager.sessionNotifyHint")}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBookFor(null)} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={bookSaving} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50">
              {bookSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CalendarPlus className="w-3 h-3" />} {t("venture.manager.bookSession")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => openBooking(milestone)}
          className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]"
        >
          <CalendarPlus className="w-3 h-3" /> {t("venture.manager.bookSession")}
        </button>
      )}
    </div>
  );
}
