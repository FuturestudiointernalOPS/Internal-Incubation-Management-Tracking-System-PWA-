"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function IntelligencePage() {
  const { t } = useI18n();
  return (
    <>
      <div className="p-6 flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-8 h-8 text-[var(--brand-orange)]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)] mb-3">
            {t("adminMisc.intelligence.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {t("adminMisc.intelligence.comingSoon")}
          </p>
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)]">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase text-amber-400">
              {t("adminMisc.intelligence.pending")}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
