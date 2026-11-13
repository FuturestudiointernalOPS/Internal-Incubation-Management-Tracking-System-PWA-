import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export function VerificationLoading() {
  return (
    <>
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    </>
  );
}

export function VerificationError({ t, message, onBack }) {
  return (
    <>
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t("vadmin.verification.error")}</h2>
        <p className="text-[var(--text-secondary)] mb-6">{message || t("vadmin.verification.ventureNotFound")}</p>
        <button onClick={onBack} className="btn btn-primary">{t("vadmin.verification.backToVentures")}</button>
      </div>
    </>
  );
}

export function VerificationToast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${
      toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
    }`}>
      {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
      {toast.msg}
    </div>
  );
}
