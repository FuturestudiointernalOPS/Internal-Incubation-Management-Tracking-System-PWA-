"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function IntelligencePage() {
  const { t } = useI18n();
  return (
    <DashboardLayout role="super_admin">
      <div className="p-6 flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-8 h-8 text-[var(--brand-orange)]" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)] mb-3">
            {t("adminMisc.intelligence.title")}
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] font-bold leading-relaxed">
            {t("adminMisc.intelligence.comingSoon")}
          </p>
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)]">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
              {t("adminMisc.intelligence.pending")}
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
