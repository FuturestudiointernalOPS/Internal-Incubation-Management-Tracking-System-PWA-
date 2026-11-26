"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * The two inline notices of the manager panel: the transient status message
 * (never a floating top-right toast) and the warning that the deliverables
 * could not be read.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name, so the markup and its behaviour are unchanged.
 */
export default function JourneyNotices({ toast, deliverablesUnavailable }) {
  const { t } = useI18n();
  return (
    <>
      {/* Inline status message — never a floating top-right toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${toast.type === "error" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>
          {toast.type === "error" ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* The deliverables could not be read — say so, rather than showing an
          empty list that reads as "this Venture has no evidence". */}
      {deliverablesUnavailable && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t("venture.manager.deliverablesUnavailable")}</span>
        </div>
      )}
    </>
  );
}
