import { AlertTriangle, CheckCircle2, Loader2, Shield, X } from "lucide-react";

export default function ReviewModal({
  open,
  venture,
  reviewDecision,
  reviewNotes,
  reviewing,
  onClose,
  onDecisionChange,
  onNotesChange,
  onReview,
  t,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.verification.reviewVerification")}</h2>
              <p className="text-[10px] text-[var(--text-secondary)]">{venture.company_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.verification.decision")}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { value: "verified", label: "vadmin.verification.approve", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20" },
                { value: "rejected", label: "vadmin.verification.reject", icon: X, color: "bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20" },
                { value: "suspended", label: "vadmin.verification.suspend", icon: AlertTriangle, color: "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20" },
              ].map((decisionOption) => (
                <button key={decisionOption.value}
                  onClick={() => onDecisionChange(decisionOption.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider ${
                    reviewDecision === decisionOption.value ? `${decisionOption.color} ring-2 ring-offset-1` : "bg-primary border-[var(--border-primary)] text-slate-500 hover:border-slate-500/30"
                  }`}>
                  <decisionOption.icon className="w-5 h-5" />
                  {t(decisionOption.label)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.verification.notesOptional")}</label>
            <textarea value={reviewNotes} onChange={(event) => onNotesChange(event.target.value)}
              rows={3} placeholder={t("vadmin.verification.reviewNotesPlaceholder")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all">{t("vadmin.verification.cancel")}</button>
          <button onClick={onReview} disabled={reviewing}
            className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
            {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {reviewing ? t("vadmin.verification.processing") : t("vadmin.verification.submitReview")}
          </button>
        </div>
      </div>
    </div>
  );
}
