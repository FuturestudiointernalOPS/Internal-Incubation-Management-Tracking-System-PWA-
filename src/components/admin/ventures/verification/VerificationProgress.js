import { CheckCircle2, Clock, Loader2, Send, Upload, X } from "lucide-react";
import { documentTypeIcon, documentTypeName, isUploadDocumentType } from "@/components/ventures/documentTypeMeta";
import DataBankDocumentRow from "@/components/ventures/DataBankDocumentRow";
import { VerificationItemStatusBadge } from "./verificationStatus";

export default function VerificationProgress({
  id,
  documentTypes,
  uploading,
  verification,
  reviewing,
  t,
  lang,
  getItemForCategory,
  getDocsForCategory,
  onUpload,
  onReviewItem,
  onReload,
  onSubmit,
  onResubmit,
}) {
  return (
    <div className="card">
      <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">{t("vadmin.verification.progress")}</h3>
      <div className="space-y-3">
        {documentTypes.map((documentType) => {
          const stepKey = documentType.code;
          const item = getItemForCategory(stepKey);
          const stepDocs = getDocsForCategory(stepKey);
          const StepIcon = documentTypeIcon(stepKey);
          const isUploading = uploading[stepKey];
          const isUpload = isUploadDocumentType(documentType);
          return (
            <div key={stepKey} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <StepIcon className="w-4 h-4 text-[var(--brand-orange)]" />
                  <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">{documentTypeName(documentType, lang, t)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item && <VerificationItemStatusBadge status={item.status} t={t} />}
                  {item?.notes && (
                    <span className="text-[10px] text-[var(--text-secondary)] max-w-[200px] truncate" title={item.notes}>{item.notes}</span>
                  )}
                </div>
              </div>

              {documentType.description && (
                <p className="text-[10px] text-[var(--text-secondary)] mb-3 break-words">{documentType.description}</p>
              )}

              {/* Uploaded documents */}
              {stepDocs.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {stepDocs.map((documentEntry) => (
                    <DataBankDocumentRow
                      key={documentEntry.id}
                      ventureId={id}
                      doc={documentEntry}
                      canUpload={isUpload && item?.status !== "verified"}
                      onChanged={() => onReload(true)}
                    />
                  ))}
                </div>
              )}

              {/* Upload button (only for upload-backed, non-verified types) */}
              {isUpload && item?.status !== "verified" && (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-orange/10 text-[var(--brand-orange)] rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all">
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {isUploading ? t("vadmin.verification.uploading") : t("vadmin.verification.upload")}
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden"
                    disabled={isUploading}
                    onChange={(event) => { if (event.target.files[0]) onUpload(stepKey, event.target.files[0]); event.target.value = ""; }}
                  />
                </label>
              )}
              {!isUpload && stepKey === "email_verification" && <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.verification.emailVerifiedViaLink")}</p>}
              {!isUpload && stepKey === "phone_verification" && <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.verification.phoneVerifiedViaSms")}</p>}
              {!isUpload && stepKey !== "email_verification" && stepKey !== "phone_verification" && (
                <p className="text-[10px] text-[var(--text-secondary)]">{t("venture.verificationTab.confirmedAnotherWay")}</p>
              )}

              {/* Per-document review (decision Q6): validate or reject ONE
                  document at a time. Hidden for not_applicable items. */}
              {item && item.status !== "not_applicable" && (
                <div className="flex gap-2 mt-3">
                  {item.status !== "verified" && (
                    <button
                      type="button"
                      onClick={() => onReviewItem(stepKey, "verified")}
                      disabled={reviewing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all disabled:opacity-30"
                    >
                      {reviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {t("vadmin.verification.approve")}
                    </button>
                  )}
                  {item.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={() => onReviewItem(stepKey, "rejected")}
                      disabled={reviewing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-all disabled:opacity-30"
                    >
                      {reviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      {t("vadmin.verification.reject")}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        {verification?.status === "draft" || verification?.status === "rejected" ? (
          <button onClick={verification?.status === "rejected" ? onResubmit : onSubmit}
            className="px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Send className="w-4 h-4" />
            {verification?.status === "rejected" ? t("vadmin.verification.resubmitForReview") : t("vadmin.verification.submitForReview")}
          </button>
        ) : null}
        {verification?.status === "pending_review" && (
          <span className="text-[10px] font-bold text-amber-400 flex items-center gap-2 px-4 py-3 bg-amber-500/10 rounded-xl">
            <Clock className="w-4 h-4" /> {t("vadmin.verification.pendingReviewerAction")}
          </span>
        )}
        {verification?.status === "verified" && (
          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-2 px-4 py-3 bg-emerald-500/10 rounded-xl">
            <CheckCircle2 className="w-4 h-4" /> {t("vadmin.verification.allVerified")}
          </span>
        )}
      </div>
    </div>
  );
}
