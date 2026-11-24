"use client";

import { ArrowLeft, CheckCircle2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

/**
 * The due-diligence header row: back button, venture title/meta and the
 * Complete action.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function DiligenceHeader({ onBack, pipeline, workspace, onComplete }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-4">
      <button onClick={onBack} className="p-2 hover:text-[var(--brand-orange)]"><ArrowLeft className="w-5 h-5" /></button>
      <div className="flex-1">
        <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
          {t("dueDiligence")}: {pipeline?.venture_name || "Venture"}
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">{pipeline?.industry} · {pipeline?.country} · {pipeline?.business_stage}</p>
      </div>
      {workspace && workspace.status !== "completed" && (
        <AppButton variant="primary" icon={CheckCircle2} onClick={onComplete}>Complete</AppButton>
      )}
    </div>
  );
}
