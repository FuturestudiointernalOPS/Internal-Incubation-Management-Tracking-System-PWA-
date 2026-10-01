"use client";

import { useI18n } from "@/lib/i18n";

/**
 * The page header: eyebrow, title, subtitle.
 * Extracted verbatim from ScoresPage.
 */
export default function ScoresHeader() {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          {t("adminMisc.platformScores.eyebrow")}
        </span>
      </div>
      <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
        {t("adminMisc.platformScores.title")}
      </h1>
      <p className="text-sm text-[var(--text-secondary)] mt-1">
        {t("adminMisc.platformScores.subtitle")}
      </p>
    </div>
  );
}
