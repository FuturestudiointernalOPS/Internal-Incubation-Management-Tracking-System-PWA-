"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { ChevronUp, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useApi } from "@/lib/hooks/useApi";
import PlanUpload from "./plan-import/PlanUpload";
import PlanReview from "./plan-import/PlanReview";

/**
 * PlanImportPanel — the programme import, on the Journey surface.
 *
 * A tracker is an INPUT, never the source of truth. Phase 1 reads it and asks
 * the analyst for a proposal; Phase 2 lets a human correct that proposal and
 * keeps it as a DRAFT. Nothing here creates a journey, milestone, task or
 * deliverable — the panel says so on screen, because a screen that looks
 * finished is worse than one that admits what it has not done.
 *
 * The format and size rules come from lib/venturePlanSheetRules, the same ones
 * the route applies, so the form cannot offer a file the server would refuse.
 *
 * The two steps live in `plan-import/`: `PlanUpload` (choose and read a file)
 * and `PlanReview` (correct and apply the proposal). This module only loads the
 * stored draft and switches between them.
 *
 * The upload form is an ACTION, not furniture: the panel opens collapsed and
 * the form appears only when someone clicks to upload. A stored draft, on the
 * other hand, is active work and stays open.
 */
export default function PlanImportPanel({ ventureId }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: draft, loading, refresh: refreshDraft } = useApi(
    ventureId ? `/api/ventures/${ventureId}/plan-import` : null,
    { defaultValue: null, transform: (payload) => (payload?.success ? payload.draft : null) },
  );

  const discard = async () => {
    if (!draft?.id) return;
    if (!(await confirm({ message: t("venture.planImport.discardConfirm"), tone: "danger" }))) return;
    try {
      await fetch(`/api/ventures/${ventureId}/plan-import`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draft.id, action: "discard" }),
      });
    } finally {
      setUploadOpen(false);
      refreshDraft();
    }
  };

  return (
    <div className="card mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.planImport.title")}
          {draft && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
              {t("venture.planImport.draftBadge")}
            </span>
          )}
        </h3>
        {draft ? (
          <button
            type="button"
            onClick={discard}
            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            {t("venture.planImport.discard")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setUploadOpen((open) => !open)}
            aria-expanded={uploadOpen}
            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black hover:opacity-90 flex items-center gap-1.5"
          >
            {uploadOpen ? <ChevronUp className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
            {t(uploadOpen ? "venture.planImport.hideUpload" : "venture.planImport.showUpload")}
          </button>
        )}
      </div>

      {loading && !draft ? (
        <div className="text-center py-6">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
        </div>
      ) : draft ? (
        // `key` so a replaced draft remounts with its own working copy rather
        // than editing the draft that is no longer there.
        <PlanReview key={draft.id} ventureId={ventureId} draft={draft} onSaved={refreshDraft} />
      ) : uploadOpen ? (
        <PlanUpload
          ventureId={ventureId}
          onUploaded={async () => {
            // The proposal replaces the form: collapse behind it.
            setUploadOpen(false);
            await refreshDraft();
          }}
        />
      ) : null}
    </div>
  );
}
