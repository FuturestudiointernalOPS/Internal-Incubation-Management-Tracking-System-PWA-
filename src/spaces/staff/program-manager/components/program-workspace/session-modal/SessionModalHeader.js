"use client";

import { useI18n } from "@/lib/i18n";
import { FileText, X } from "lucide-react";

export default function SessionModalHeader({
  t,
  newSession,
  onCloseSessionModal,
}) {
  return (
    <div className="flex justify-between items-center pb-4 border-b border-[var(--border-primary)]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-brand-orange/10 flex items-center justify-center">
          <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
        </div>
        <div>
          <h3
            className="text-sm font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("pmMisc.workspace.newSessionTitle")}
          </h3>
          <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
            {t("pmMisc.workspace.week")} {newSession.week_number}
          </p>
        </div>
      </div>
      <button
        onClick={onCloseSessionModal}
        className="p-2 hover:bg-[var(--surface-2)] rounded-lg transition-all"
      >
        <X className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
      </button>
    </div>
  );
}