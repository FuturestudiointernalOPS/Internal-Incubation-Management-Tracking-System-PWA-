"use client";

import { AlertTriangle, AlertCircle, Loader2 } from "lucide-react";

export default function ConfirmDialog({ confirmAction, setConfirmAction, transferring, t }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            confirmAction.variant === "danger" ? "bg-rose-500/10" : "bg-amber-500/10"
          }`}>
            {confirmAction.variant === "danger" ? (
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            ) : (
              <AlertCircle className="w-8 h-8 text-amber-400" />
            )}
          </div>
          <h2 className="text-lg font-black text-[var(--text-primary)]">{confirmAction.title}</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2">{confirmAction.message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmAction(null)}
            className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            {t("vadmin.founders.cancel")}
          </button>
          <button
            onClick={() => {
              if (confirmAction.onConfirm) confirmAction.onConfirm();
            }}
            disabled={transferring}
            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2 ${
              confirmAction.variant === "danger"
                ? "bg-rose-600 text-white"
                : "bg-[var(--brand-orange)] text-black"
            }`}
          >
            {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {transferring ? t("vadmin.founders.processing") : confirmAction.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
