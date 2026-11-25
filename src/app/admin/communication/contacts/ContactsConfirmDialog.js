"use client";

import { AlertTriangle } from "lucide-react";

export function ContactsConfirmDialog({ t, confirmTarget, setConfirmTarget }) {
  return (
    <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-6" onClick={() => setConfirmTarget(null)}>
      <div className="card w-full max-w-sm space-y-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight">{t("crm.contacts.confirmAction")}</h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{confirmTarget.message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">{t("crm.contacts.cancel")}</button>
          <button onClick={() => { confirmTarget.onConfirm(); setConfirmTarget(null); }} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-600 transition-all">{t("crm.contacts.confirm")}</button>
        </div>
      </div>
    </div>
  );
}
