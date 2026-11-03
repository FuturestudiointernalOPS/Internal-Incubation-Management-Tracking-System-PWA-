"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import SectionHead from "@/components/ui/SectionHead";

/**
 * THE GLOSSARY — read-only, in the reader's own language.
 *
 * The definitions are the single source of truth for churn, retention, LTV and
 * the stage criteria, so they must be readable wherever a decision is made:
 * on the founder's screen and on the studio's review screen. Editing lives in
 * the studio settings screen, and only there.
 */
export default function VentureGlossary({ ventureId }) {
  const { t, lang } = useI18n();
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(
      `/api/ventures/${encodeURIComponent(ventureId)}/reporting/settings`,
    );
    const payload = await response.json().catch(() => ({}));
    if (payload?.success && Array.isArray(payload.glossary)) setTerms(payload.glossary);
    setLoading(false);
  }, [ventureId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;

  return (
    <div className="space-y-4">
      <SectionHead
        title={t("venture.reporting.glossary.title")}
        subtitle={t("venture.reporting.glossary.subtitle")}
      />

      <AppCard padding="normal" className="space-y-4">
        {terms.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.glossary.empty")}
          </p>
        ) : (
          terms.map((entry) => (
            <div
              key={entry.term}
              className="space-y-1 border-b pb-3 last:border-0 last:pb-0"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>
                {t(`venture.reporting.glossary.term.${entry.term}`)}
              </p>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {lang === "fr"
                  ? entry.definition_fr || entry.definition_en
                  : entry.definition_en || entry.definition_fr}
              </p>
            </div>
          ))
        )}
      </AppCard>
    </div>
  );
}
