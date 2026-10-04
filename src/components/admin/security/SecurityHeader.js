"use client";

import { Shield, RefreshCw } from "lucide-react";

export default function SecurityHeader({ t, onRefresh }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
          <Shield className="text-[var(--brand-orange)]" size={24} />
          {t("adminMisc.security.title")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{t("adminMisc.security.subtitle")}</p>
      </div>
      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl hover:bg-[var(--surface-2)] transition-colors text-sm"
      >
        <RefreshCw size={14} />
        {t("adminMisc.security.refresh")}
      </button>
    </div>
  );
}
