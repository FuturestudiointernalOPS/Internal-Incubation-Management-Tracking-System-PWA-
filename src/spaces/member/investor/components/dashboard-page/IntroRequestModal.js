"use client";

import { Send } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import InvestorModal from "./InvestorModal";

/**
 * The "request an introduction" window, in the workspace's one frame.
 */
export default function IntroRequestModal({
  introVenture,
  introMessage,
  onMessageChange,
  processingId,
  onClose,
  onSubmit,
}) {
  const { t } = useI18n();
  return (
    <InvestorModal
      title={t("member.investor.browser.intro.title")}
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <>
          <AppButton variant="secondary" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </AppButton>
          <AppButton
            variant="primary"
            size="sm"
            icon={Send}
            loading={processingId !== null}
            disabled={processingId !== null}
            onClick={onSubmit}
          >
            {t("member.investor.browser.intro.submit")}
          </AppButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {t("member.investor.browser.intro.lead")}{" "}
          <b className="text-[var(--text-primary)]">{introVenture.name}</b>.{" "}
          {t("member.investor.browser.intro.after")}
        </p>
        <div>
          <label
            htmlFor="investor-intro-message"
            className="stf-k"
          >
            {t("member.investor.browser.intro.statement")}
          </label>
          <textarea
            id="investor-intro-message"
            value={introMessage}
            onChange={(event) => onMessageChange(event.target.value)}
            rows={3}
            placeholder={t("member.investor.browser.intro.placeholder")}
            className="mt-1.5 w-full resize-none rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/25"
          />
        </div>
      </div>
    </InvestorModal>
  );
}
