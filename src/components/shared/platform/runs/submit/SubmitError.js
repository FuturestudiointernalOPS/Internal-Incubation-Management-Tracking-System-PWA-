"use client";

import { AlertTriangle } from "lucide-react";

export default function SubmitError({ t, error, goBack }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
        <h1 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runSubmitDetail.errorTitle")}</h1>
        <p className="text-[11px] text-[var(--text-secondary)]">{error}</p>
        <button onClick={goBack} className="px-4 py-2 rounded-xl bg-tertiary text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-wide">{t("platformMisc.runSubmitDetail.goBack")}</button>
      </div>
    </div>
  );
}
