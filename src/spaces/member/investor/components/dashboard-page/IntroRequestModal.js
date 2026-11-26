"use client";

import { Send, X } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

/**
 * The "request an introduction" modal.
 * Extracted verbatim from InvestorDashboard.
 */
export default function IntroRequestModal({ introVenture, introMessage, onMessageChange, processingId, onClose, onSubmit }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="investor-intro-title">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 id="investor-intro-title" className="text-sm font-black text-[var(--text-primary)] uppercase">{t("requestIntroduction")}</h3>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-[var(--text-secondary)]">
            {t("dashboardV2.requestIntroHint", { name: introVenture.name })}
          </p>
          <div>
            <label htmlFor="investor-intro-message" className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("dashboardV2.introductionNote")}</label>
            <textarea id="investor-intro-message" value={introMessage} onChange={event => onMessageChange(event.target.value)}
              maxLength={1000} rows={3} placeholder={t("dashboardV2.introductionNotePlaceholder")}
              className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
            <p className="stf-small mt-1 text-right">{introMessage.length}/1000</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button type="button" onClick={onClose} className="min-h-11 px-4 text-[10px] font-black text-[var(--text-secondary)] uppercase rounded-xl hover:bg-[var(--surface-3)]">{t("cancel")}</button>
          <AppButton variant="primary" icon={Send} loading={processingId !== null} disabled={processingId !== null}
            onClick={onSubmit}>
            {t("submit")}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
