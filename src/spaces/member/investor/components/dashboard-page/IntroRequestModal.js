"use client";

import { Send, X } from "lucide-react";
import AppButton from "@/components/ui/AppButton";

/**
 * The "request an introduction" modal.
 * Extracted verbatim from InvestorDashboard.
 */
export default function IntroRequestModal({ introVenture, introMessage, onMessageChange, processingId, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Request Introduction</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-[var(--text-secondary)]">
            You are requesting an introduction to <b className="text-[var(--text-primary)]">{introVenture.name}</b>.
            Future Studio will review your request and coordinate the introduction.
          </p>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Investment Interest Statement</label>
            <textarea value={introMessage} onChange={event => onMessageChange(event.target.value)}
              rows={3} placeholder="Briefly describe why you are interested in this opportunity..."
              className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-[10px] font-black text-[var(--text-secondary)] uppercase rounded-xl hover:bg-[var(--surface-3)]">Cancel</button>
          <AppButton variant="primary" icon={Send} loading={processingId !== null} disabled={processingId !== null}
            onClick={onSubmit}>
            Submit Request
          </AppButton>
        </div>
      </div>
    </div>
  );
}
