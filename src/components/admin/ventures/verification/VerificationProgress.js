import { CheckCircle2, Clock, Eye, FileText, Loader2, Send, X } from "lucide-react";
import { documentTypeIcon, documentTypeName, isUploadDocumentType } from "@/components/ventures/documentTypeMeta";
import DataBankDocumentRow from "@/components/ventures/DataBankDocumentRow";
import { VerificationItemStatusBadge } from "./verificationStatus";

export default function VerificationProgress({
  id,
  documentTypes,
  verification,
  reviewing,
  t,
  lang,
  getItemForCategory,
  getDocsForCategory,
  unassignedDocs = [],
  onReviewItem,
  onReload,
  onSubmit,
  onResubmit,
}) {
  return (
    <div className="card">
      <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">{t("vadmin.verification.progress")}</h3>
      <div className="space-y-6">
        {/* Readiness documents */}
        <div className="space-y-3">
          <div className="mb-1">
            <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">{t("vadmin.verification.readinessDocuments")}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t("vadmin.verification.readinessDocumentsHint")}</p>
          </div>
          {documentTypes
            .filter((documentType) => documentType.required === true && documentType.is_readiness !== false)
            .map((documentType) => {
          const stepKey = documentType.code;
          const item = getItemForCategory(stepKey);
          const stepDocs = getDocsForCategory(stepKey);
          const StepIcon = documentTypeIcon(stepKey);
          const isUpload = isUploadDocumentType(documentType);
          // The first uploaded doc with a viewable URL, used for the PDF preview
          const previewDoc = stepDocs.find((d) => d.file_url_signed || /^https?:\/\//i.test(String(d.file_url || "")));
          const previewHref = previewDoc?.file_url_signed || (
            /^https?:\/\//i.test(String(previewDoc?.file_url || "")) ? previewDoc?.file_url : null
          );
          const isPdf = previewDoc && (
            String(previewDoc.file_name || "").toLowerCase().endsWith(".pdf") ||
            String(previewDoc.file_type || "").includes("pdf")
          );
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

              {/* PDF peek — overflow/scale effect: shows the top of the document
                  inline without opening it. The iframe is scaled down and clipped
                  so the section stays ≤ 1.5× its natural height. */}
              {isPdf && previewHref && (
                <div
                  className="relative mb-3 rounded-lg overflow-hidden border border-[var(--border-primary)] bg-surface-2"
                  style={{ height: "72px" }}
                  title={t("vadmin.verification.pdfPreviewHint")}
                >
                  <iframe
                    src={`${previewHref}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    className="absolute top-0 left-0 w-full pointer-events-none"
                    style={{
                      height: "400px",
                      transform: "scale(0.35)",
                      transformOrigin: "top left",
                      width: "285%",
                    }}
                    loading="lazy"
                    sandbox="allow-same-origin"
                    title={documentTypeName(documentType, lang, t)}
                  />
                  {/* Gradient fade at the bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--bg-tertiary)] to-transparent pointer-events-none" />
                  {/* "Preview" badge */}
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/40 text-white/70 flex items-center gap-1 pointer-events-none">
                    <Eye className="w-2.5 h-2.5" /> {t("vadmin.verification.preview")}
                  </span>
                </div>
              )}

              {/* Uploaded documents list — admin is read-only (canUpload=false) */}
              {stepDocs.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {stepDocs.map((documentEntry) => (
                    <DataBankDocumentRow
                      key={documentEntry.id}
                      ventureId={id}
                      doc={documentEntry}
                      canUpload={false}
                      onChanged={() => onReload(true)}
                    />
                  ))}
                </div>
              )}

              {/* A slot that expects a file but has none is stated outright.
                  Left blank it read like a section that simply had nothing to
                  show, which is how "documents were added" got mistaken for a
                  row with a missing View button. */}
              {isUpload && stepDocs.length === 0 && (
                <p className="text-[10px] text-[var(--text-secondary)] mb-3">
                  {t("venture.verificationTab.missingDocuments")}
                </p>
              )}

              {/* No upload button for admin — ventures upload, admins review */}
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
      </div>
      {/* Files whose category matches no configured document type. They are
          stored and reviewable, so they must stay visible — they are just

        {/* Contact verification */}
        <div className="space-y-3">
          <div className="mb-1">
            <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">{t("vadmin.verification.contactVerification")}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t("vadmin.verification.contactVerificationHint")}</p>
          </div>
          <div className="space-y-1.5">
            {documentTypes
              .filter((documentType) => !(documentType.required === true && documentType.is_readiness !== false))
              .map((documentType) => {
                const stepKey = documentType.code;
                const item = getItemForCategory(stepKey);
                const stepDocs = getDocsForCategory(stepKey);
                const StepIcon = documentTypeIcon(stepKey);
                const isUpload = isUploadDocumentType(documentType);
                const previewDoc = stepDocs.find((d) => d.file_url_signed || /^https?:\/\//i.test(String(d.file_url || "")));
                return (
                  <div key={documentType.code} className="p-4 rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <StepIcon size={14} className="text-[var(--brand-orange)]" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">{documentTypeName(documentType, lang, t)}</span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400" title={t("vadmin.verification.contactOnlyHint")}>{t("vadmin.verification.contactOnly")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item && <VerificationItemStatusBadge status={item.status} t={t} />}
                        {item?.notes && (
                          <span className="text-[10px] text-[var(--text-secondary)] max-w-[200px] truncate" title={item.notes}>{item.notes}</span>
                        )}
                      </div>
                    </div>
                    {documentType.description && (
                      <p className="text-[10px] text-[var(--text-secondary)] mt-2 leading-relaxed">{documentType.description}</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {stepDocs.length === 0 && !isUpload && (
                        <p className="text-[10px] text-[var(--text-secondary)]">{stepKey === "email_verification" ? t("vadmin.verification.emailNotVerifiedYet") : t("vadmin.verification.phoneNotVerifiedYet")}</p>
                      )}
                      {!isUpload && stepKey === "email_verification" && <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.verification.emailVerifiedViaLink")}</p>}
                      {!isUpload && stepKey === "phone_verification" && <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.verification.phoneVerifiedViaSms")}</p>}
                      {!isUpload && stepKey !== "email_verification" && stepKey !== "phone_verification" && (
                        <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.verification.externalVerification")}</p>
                      )}
                      {stepDocs.map((documentEntry) => (
                        <DataBankDocumentRow
                          key={documentEntry.id}
                          ventureId={id}
                          doc={documentEntry}
                          canUpload={false}
                          onChanged={() => onReload(true)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        {/* Files whose category matches no configured document type. They are
            stored and reviewable, so they must stay visible — they are just
            not attached to any slot above. */}
        {unassignedDocs.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <FileText className="w-3 h-3" />
            {t("venture.verificationTab.unassignedDocuments")}
          </h3>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1 mb-3">
            {t("venture.verificationTab.unassignedDocumentsHint")}
          </p>
          <div className="space-y-1.5">
            {unassignedDocs.map((documentEntry) => (
              <DataBankDocumentRow
                key={documentEntry.id}
                ventureId={id}
                doc={documentEntry}
                canUpload={false}
                onChanged={() => onReload(true)}
              />
            ))}
          </div>
        </div>
      )}

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
