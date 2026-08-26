"use client";

import { useI18n } from "@/lib/i18n";
import { Lock } from "lucide-react";

/**
 * Server-side rendered denial screen for messaging pages.
 * Shown when a user who is not eligible for internal Messaging reaches a
 * messages URL directly (e.g. /participant/messages, /teacher/messages).
 * No messaging content or data is ever rendered for ineligible users.
 */
export default function MessagingAccessDenied() {
  const { t } = useI18n();
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-surface-3 flex items-center justify-center">
        <Lock className="w-5 h-5 text-[var(--text-secondary)]" />
      </div>
      <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
        {t("messaging.accessDeniedTitle")}
      </h1>
      <p className="text-[12px] text-[var(--text-secondary)] max-w-sm">
        {t("messaging.accessDeniedSubtitle")}
      </p>
    </div>
  );
}
