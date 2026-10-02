"use client";

import { useI18n } from "@/lib/i18n";

/**
 * The page title and subtitle.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function RelationshipsHeader() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
          {t("investorAdmin.relationships.title")}
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          {t("investorAdmin.relationships.subtitle")}
        </p>
      </div>
    </div>
  );
}
