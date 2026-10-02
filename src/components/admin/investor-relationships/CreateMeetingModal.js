"use client";

import { Calendar, X } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { MEETING_TYPES } from "./constants";

/**
 * The "schedule a meeting" modal. The form state lives in the page.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function CreateMeetingModal({ meetingForm, setMeetingForm, onClose, onSubmit }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.scheduleMeeting")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.meetingType")}</label>
            <select value={meetingForm.meeting_type} onChange={event => setMeetingForm({...meetingForm, meeting_type: event.target.value})}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60">
              {MEETING_TYPES.map(meetingType => <option key={meetingType.value} value={meetingType.value}>{t(meetingType.label)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.dateLabel")}</label>
              <input type="date" value={meetingForm.scheduled_date} onChange={event => setMeetingForm({...meetingForm, scheduled_date: event.target.value})}
                className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.time")}</label>
              <input type="time" value={meetingForm.scheduled_time} onChange={event => setMeetingForm({...meetingForm, scheduled_time: event.target.value})}
                className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.durationLabel")}</label>
            <input type="number" value={meetingForm.duration_minutes} onChange={event => setMeetingForm({...meetingForm, duration_minutes: parseInt(event.target.value) || 60})}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.location")}</label>
            <input value={meetingForm.location} onChange={event => setMeetingForm({...meetingForm, location: event.target.value})}
              placeholder={t("investorAdmin.relationships.locationPlaceholder")}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.notes")}</label>
            <textarea value={meetingForm.notes} onChange={event => setMeetingForm({...meetingForm, notes: event.target.value})}
              rows={2} placeholder={t("investorAdmin.relationships.notesPlaceholder")}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-brand-orange/60" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <AppButton variant="secondary" size="sm" onClick={onClose}>{t("investorAdmin.relationships.cancel")}</AppButton>
          <AppButton variant="primary" size="sm" icon={Calendar} onClick={onSubmit}>{t("investorAdmin.relationships.schedule")}</AppButton>
        </div>
      </div>
    </div>
  );
}
