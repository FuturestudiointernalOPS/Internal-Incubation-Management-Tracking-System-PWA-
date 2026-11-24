"use client";

import { Shield, X } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

const DD_CATEGORY_OPTIONS = ["corporate", "financial", "commercial", "technical", "legal"];

/**
 * The "add a due-diligence request" modal. The form state lives in the page.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function AddDdRequestModal({ requestForm, setRequestForm, onClose, onSubmit }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.relationships.addDdRequest")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.titleLabel")}</label>
            <input value={requestForm.title} onChange={event => setRequestForm({...requestForm, title: event.target.value})}
              placeholder={t("investorAdmin.relationships.titlePlaceholder")}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.category")}</label>
              <select value={requestForm.category} onChange={event => setRequestForm({...requestForm, category: event.target.value})}
                className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60">
                {DD_CATEGORY_OPTIONS.map(categoryOption => <option key={categoryOption} value={categoryOption}>{categoryOption.charAt(0).toUpperCase()+categoryOption.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.priority")}</label>
              <select value={requestForm.priority} onChange={event => setRequestForm({...requestForm, priority: event.target.value})}
                className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60">
                <option value="low">{t("investorAdmin.relationships.priorityLow")}</option>
                <option value="medium">{t("investorAdmin.relationships.priorityMedium")}</option>
                <option value="high">{t("investorAdmin.relationships.priorityHigh")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.dueDate")}</label>
            <input type="date" value={requestForm.due_date} onChange={event => setRequestForm({...requestForm, due_date: event.target.value})}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.relationships.description")}</label>
            <textarea value={requestForm.description} onChange={event => setRequestForm({...requestForm, description: event.target.value})}
              rows={2} placeholder={t("investorAdmin.relationships.descriptionPlaceholder")}
              className="w-full mt-1 px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none focus:border-brand-orange/60" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <AppButton variant="secondary" size="sm" onClick={onClose}>{t("investorAdmin.relationships.cancel")}</AppButton>
          <AppButton variant="primary" size="sm" icon={Shield} onClick={onSubmit}>{t("investorAdmin.relationships.addRequest")}</AppButton>
        </div>
      </div>
    </div>
  );
}
