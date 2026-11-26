"use client";

import { Save, Send } from "lucide-react";

export default function SubmitFooterActions({
  t,
  saving,
  needsRevision,
  handleSaveDraft,
  handleSubmit,
}) {
  return (
    <div className="sticky bottom-4 z-20">
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary border border-[var(--border-primary)] shadow-lg">
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-tertiary text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary/80 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? t("platformMisc.runSubmitDetail.saving") : t("platformMisc.runSubmitDetail.saveDraft")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          {saving ? t("platformMisc.runSubmitDetail.submitting") : needsRevision ? t("platformMisc.runSubmitDetail.resubmit") : t("platformMisc.runSubmitDetail.submit")}
        </button>
      </div>
    </div>
  );
}
