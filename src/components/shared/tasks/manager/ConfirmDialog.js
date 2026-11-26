"use client";

import { AlertTriangle } from "lucide-react";

/**
 * The manager's confirmation prompt.
 *
 * It renders nothing until `confirmAction` is set, so the caller parks the
 * question it wants to ask there ({ message, onConfirm }) and this is the only
 * thing that can dismiss it.
 */
export default function ConfirmDialog({ confirmAction, onDismiss }) {
  if (!confirmAction) return null;

  return (
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="card w-full max-w-sm space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">
              Confirm Action
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {confirmAction.message}
            </p>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              const onConfirm = confirmAction.onConfirm;
              onDismiss();
              onConfirm();
            }}
            className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-600 transition-all"
          >
            Confirm
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2.5 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-[var(--text-primary)] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}