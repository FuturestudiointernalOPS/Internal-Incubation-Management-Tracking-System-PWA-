import { ArrowLeft, FileText, Shield } from "lucide-react";
import { VerificationStatusBadge } from "./verificationStatus";

export default function VerificationHeader({
  venture,
  verification,
  t,
  onBack,
  onOpenDocumentTypes,
  onOpenReview,
}) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <button onClick={onBack}
          className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-3">
          <ArrowLeft className="w-3 h-3" /> {t("vadmin.verification.backTo", { name: venture.company_name })}
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{t("vadmin.verification.startupVerification")}</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{venture.company_name} · {venture.venture_id}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onOpenDocumentTypes}
          className="px-4 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2"
          title={t("venture.documentTypes.ventureHint")}
        >
          <FileText className="w-3.5 h-3.5" /> {t("venture.documentTypes.title")}
        </button>
        {verification && <VerificationStatusBadge status={verification.status} t={t} />}
        {verification?.status === "pending_review" && (
          <button onClick={onOpenReview}
            className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> {t("vadmin.verification.review")}
          </button>
        )}
      </div>
    </div>
  );
}
