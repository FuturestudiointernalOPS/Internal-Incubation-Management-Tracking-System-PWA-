"use client";

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";

/**
 * The words of each confirmation the journey manager asks: completing or
 * archiving a milestone, archiving / restoring / deleting journeys. Archive and
 * delete ask twice (step 1, then step 2); restore asks once.
 */
function confirmCopy(state, t) {
  if (!state) return { title: "", body: "", confirm: "" };
  if (state.kind === "milestone-complete") {
    return {
      title: t("venture.manager.markCompleted"),
      body: t("venture.manager.completeMilestoneConfirm", { name: state.name }),
      confirm: t("venture.manager.markCompleted"),
    };
  }
  if (state.kind === "milestone-archive") {
    return {
      title: t("venture.manager.archiveMilestone"),
      body: t("venture.manager.milestoneArchiveConfirm", { name: state.name }),
      confirm: t("venture.manager.archiveMilestone"),
    };
  }
  if (state.kind === "archive") {
    return {
      title: t("venture.manager.archiveJourney"),
      body:
        state.step === 1
          ? t("venture.manager.archiveJourneysConfirm", { n: state.n })
          : t("venture.manager.archiveJourneysConfirm2", { n: state.n }),
      confirm: t("venture.manager.archiveJourney"),
    };
  }
  if (state.kind === "restore") {
    return {
      title: t("venture.manager.restoreJourney"),
      body: t("venture.manager.restoreJourneyConfirm", { name: state.name }),
      confirm: t("venture.manager.restoreJourney"),
    };
  }
  return {
    title: t("venture.manager.deleteJourney"),
    body:
      state.step === 1
        ? t("venture.manager.deleteJourneysConfirm", { n: state.n })
        : t("venture.manager.deleteJourneysConfirm2", { n: state.n }),
    confirm: t("common.delete"),
  };
}

/**
 * In-app confirmation of the journey manager (replaces browser dialogs).
 * The panel keeps the state and the action; this only renders the question.
 *
 * Props:
 *   confirmState – { kind, step, name?, n?, ids } or null (closed)
 *   busy         – an action is running: buttons disabled, closing blocked
 *   onCancel     – close without acting
 *   onConfirm    – run (or advance) the confirmed action
 */
export default function JourneyConfirmModal({ confirmState, busy, onCancel, onConfirm }) {
  const { t } = useI18n();
  const copy = confirmCopy(confirmState, t);
  return (
    <AppModal
      isOpen={Boolean(confirmState)}
      onClose={() => { if (!busy) onCancel(); }}
      title={copy.title}
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2">
          {confirmState?.step === 2 && <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />}
          <p className="text-sm text-[var(--text-secondary)]">{copy.body}</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 ${
              confirmState?.kind === "delete" && confirmState?.step === 2
                ? "bg-rose-500 text-white"
                : "bg-[var(--brand-orange)] text-black"
            }`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmState?.kind !== "restore" && confirmState?.step === 1
              ? t("common.continue")
              : copy.confirm}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
