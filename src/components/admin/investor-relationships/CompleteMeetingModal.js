"use client";

import { CheckCircle2, X } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

/**
 * The "complete a meeting" modal. The form state lives in the page.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function CompleteMeetingModal({ completeForm, setCompleteForm, onClose, onSubmit }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.completeMeeting")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {t("investorAdmin.relationships.status")}
            </label>
            <select
              value={completeForm.status}
              onChange={(event) => setCompleteForm({ ...completeForm, status: event.target.value })}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60"
            >
              <option value="held">{t("investorMisc.meetings.status.held")}</option>
              <option value="no_show">{t("investorMisc.meetings.status.no_show")}</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.outcome")}</label>
            <select value={completeForm.outcome_code} onChange={event => setCompleteForm({...completeForm, outcome_code: event.target.value})}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60">
              <option value="">{t("investorAdmin.relationships.selectOutcome")}</option>
              <option value="follow_up">{t("investorMisc.meetings.outcomeFollowUp")}</option>
              <option value="not_a_fit">{t("investorMisc.meetings.outcomeNotFit")}</option>
              <option value="more_information">{t("investorMisc.meetings.outcomeMoreInfo")}</option>
              <option value="moving_to_diligence">{t("investorMisc.meetings.outcomeMovingToDiligence")}</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.meetingNotes")}</label>
            <textarea value={completeForm.notes} onChange={event => setCompleteForm({...completeForm, notes: event.target.value})}
              rows={3} placeholder={t("investorAdmin.relationships.meetingNotesPlaceholder")}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-brand-orange/60" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.actionItemsPerLine")}</label>
            <textarea value={completeForm.action_items} onChange={event => setCompleteForm({...completeForm, action_items: event.target.value})}
              rows={3} placeholder={t("investorAdmin.relationships.actionItemsPlaceholder")}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-brand-orange/60" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <AppButton variant="secondary" size="sm" onClick={onClose}>{t("investorAdmin.relationships.cancel")}</AppButton>
          <AppButton variant="primary" size="sm" icon={CheckCircle2} onClick={onSubmit}>{t("investorAdmin.relationships.completeMeeting")}</AppButton>
        </div>
      </div>
    </div>
  );
}
