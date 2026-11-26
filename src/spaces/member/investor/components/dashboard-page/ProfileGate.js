"use client";

import { Building2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

/**
 * The "complete your profile" / "pending approval" gate shown when the investor
 * profile is missing or not yet approved.
 */
export default function ProfileGate({ profile, onSetupProfile }) {
  const { t } = useI18n();
  return (
    <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
      <Building2 className="w-16 h-16 text-[var(--text-tertiary)] mx-auto" />
      <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase">
        {!profile ? t("dashboardV2.profileGate.setupTitle") : t("dashboardV2.profileGate.pendingTitle")}
      </h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
        {!profile
          ? t("dashboardV2.profileGate.setupHint")
          : t("dashboardV2.profileGate.pendingHint")}
      </p>
      {!profile && (
        <AppButton variant="primary" onClick={onSetupProfile}>
          {t("dashboardV2.profileGate.setupCta")}
        </AppButton>
      )}
    </div>
  );
}
