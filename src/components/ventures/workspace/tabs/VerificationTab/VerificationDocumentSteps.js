"use client";

import { FileText, Loader2, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { documentTypeIcon, documentTypeName, isUploadDocumentType } from "../../../documentTypeMeta";
import DataBankDocumentRow from "../../../DataBankDocumentRow";

/**
 * The verification document steps: the empty state, the "still required" line,
 * and one section per configured document type with its upload control. Every
 * value and callback comes from the parent (`VerificationTab`), which owns the
 * read and the writes; this component only renders.
 */
const ITEM_STATUS = {
  pending: { label: "vadmin.verification.itemStatusPending", cls: "bg-white/10 text-slate-400" },
  under_review: { label: "vadmin.verification.itemStatusUnderReview", cls: "bg-amber-500/15 text-amber-400" },
  verified: { label: "vadmin.verification.statusVerified", cls: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "vadmin.verification.statusRejected", cls: "bg-rose-500/15 text-rose-400" },
  not_applicable: { label: "vadmin.verification.itemStatusNotApplicable", cls: "bg-white/5 text-slate-500" },
};

export default function VerificationDocumentSteps({
  hasData,
  stillRequired,
  verification,
  documentTypes,
  items,
  documents,
  ventureId,
  uploadingCategory,
  handleUpload,
  refresh,
}) {
  const { t, lang } = useI18n();

  if (!hasData) {
    return (
      <div className="card text-center">
        <FileText size={20} className="mx-auto mb-2 text-[var(--text-secondary)]" />
        <p className="text-[11px] text-[var(--text-secondary)]">{t("venture.verificationTab.noItems")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stillRequired.length > 0 && verification?.status !== "verified" && (
        <p className="text-[10px] text-[var(--text-secondary)]">
          {t("venture.verificationTab.stillRequired", { items: stillRequired.join(", ") })}
        </p>
      )}

      {documentTypes.map((documentType) => {
        const stepKey = documentType.code;
        const item = items.find((stepItem) => stepItem.category === stepKey);
        const stepDocs = documents.filter((doc) => doc.category === stepKey);
        const StepIcon = documentTypeIcon(stepKey);
        const isUploading = uploadingCategory === stepKey;
        const isUpload = isUploadDocumentType(documentType);
        const itemConfig = ITEM_STATUS[item?.status] || ITEM_STATUS.pending;

        return (
          <div key={stepKey} className="rounded-xl p-4 border border-[var(--border-primary)] bg-surface-2">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <div className="flex items-center gap-2">
                <StepIcon size={14} className="text-[var(--brand-orange)]" />
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                  {documentTypeName(documentType, lang, t)}
                </span>
              </div>
              {item && (
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${itemConfig.cls}`}>
                  {t(itemConfig.label)}
                </span>
              )}
            </div>

            {documentType.description && (
              <p className="text-[10px] text-[var(--text-secondary)] mb-2 break-words">{documentType.description}</p>
            )}

            {item?.notes && (
              <p className="text-[10px] text-[var(--text-secondary)] mb-2 break-words">
                {item.status === "rejected"
                  ? t("venture.manager.changesRequestedReason", { reason: item.notes })
                  : item.notes}
              </p>
            )}

            {stepDocs.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                  {t("venture.verificationTab.yourDocuments")}
                </p>
                <div className="space-y-1.5">
                  {stepDocs.map((doc) => (
                    <DataBankDocumentRow
                      key={doc.id}
                      ventureId={ventureId}
                      doc={doc}
                      canUpload={isUpload && item?.status !== "verified"}
                      onChanged={() => refresh()}
                    />
                  ))}
                </div>
              </div>
            )}

            {stepDocs.length === 0 && !isUpload && (
              <p className="text-[10px] text-[var(--text-secondary)]">
                {stepKey === "email_verification"
                  ? t("vadmin.verification.emailVerifiedViaLink")
                  : stepKey === "phone_verification"
                    ? t("vadmin.verification.phoneVerifiedViaSms")
                    : t("venture.verificationTab.confirmedAnotherWay")}
              </p>
            )}

            {stepDocs.length === 0 && isUpload && (
              <p className="text-[10px] text-[var(--text-secondary)]">{t("venture.verificationTab.missingDocuments")}</p>
            )}

            {isUpload && item?.status !== "verified" && (
              <label className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer bg-brand-orange/10 text-[var(--brand-orange)] hover:brightness-110 transition-all">
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {isUploading ? t("vadmin.verification.uploading") : t("vadmin.verification.upload")}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(event) => {
                    if (event.target.files[0]) handleUpload(stepKey, event.target.files[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
