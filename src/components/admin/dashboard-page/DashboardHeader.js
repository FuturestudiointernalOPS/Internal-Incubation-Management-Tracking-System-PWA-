"use client";

import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The dashboard's top banner: the section caption, the page title and the
 * "new programme" button.
 * Extracted verbatim from app/admin/page.js.
 */
export default function DashboardHeader({ onNewProgram }) {
  const { t } = useI18n();
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("reports.operationalReports")}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          {t("admin.command")}
        </h1>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onNewProgram}
          className="btn btn-primary gap-2"
        >
          <Plus className="w-4 h-4" /> {t("admin.newProgram")}
        </button>
      </div>
    </header>
  );
}