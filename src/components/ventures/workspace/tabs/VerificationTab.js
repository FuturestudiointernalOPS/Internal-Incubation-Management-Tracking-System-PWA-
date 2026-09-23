"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Shield,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useVenture } from "../VentureContext";

/**
 * Founder Verification tab (item A7).
 *
 * Read-only mirror of /admin/ventures/[id]/verification minus every review
 * affordance: the founder uploads and deletes documents, submits or resubmits
 * the verification and comments. Review (approve / reject / suspend) stays
 * admin-only on PATCH /api/ventures/[id]/verification/status — never called
 * from here.
 */

// Same category order as the server (VERIFICATION_CATEGORIES, src/lib/ventures.js)
// so the founder sees exactly the items the admin reviews.
const VERIFICATION_STEPS = [
  { key: "business_registration", label: "vadmin.verification.stepBusinessRegistration", icon: Building2 },
  { key: "founder_identity", label: "vadmin.verification.stepFounderIdentity", icon: User },
  { key: "email_verification", label: "vadmin.verification.stepEmailVerification", icon: Mail },
  { key: "phone_verification", label: "vadmin.verification.stepPhoneVerification", icon: Phone },
  { key: "legal_documents", label: "vadmin.verification.stepLegalDocuments", icon: Briefcase },
  { key: "financial_documents", label: "vadmin.verification.stepFinancialDocuments", icon: DollarSign },
];

const VERIFICATION_STATUS = {
  draft: { label: "vadmin.verification.statusDraft", cls: "bg-slate-500/10 text-slate-400" },
  pending_review: { label: "vadmin.verification.statusPendingReview", cls: "bg-amber-500/15 text-amber-400" },
  verified: { label: "vadmin.verification.statusVerified", cls: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "vadmin.verification.statusRejected", cls: "bg-rose-500/15 text-rose-400" },
  suspended: { label: "vadmin.verification.statusSuspended", cls: "bg-rose-500/15 text-rose-400" },
};

const ITEM_STATUS = {
  pending: { label: "vadmin.verification.itemStatusPending", cls: "bg-white/10 text-slate-400" },
  under_review: { label: "vadmin.verification.itemStatusUnderReview", cls: "bg-amber-500/15 text-amber-400" },
  verified: { label: "vadmin.verification.statusVerified", cls: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "vadmin.verification.statusRejected", cls: "bg-rose-500/15 text-rose-400" },
  not_applicable: { label: "vadmin.verification.itemStatusNotApplicable", cls: "bg-white/5 text-slate-500" },
};

// Documents are private: prefer the short-lived signed URL minted by the read
// path, and fall back to the raw value only when it is an external link
// (pasted links carry no storage path and need no signature).
const documentHref = (doc) => {
  if (doc?.file_url_signed) return doc.file_url_signed;
  const raw = String(doc?.file_url || "").trim();
  return /^https?:\/\//i.test(raw) ? raw : null;
};

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.

// The payload is kept whole, refusal included: when the server refuses the read
// its own wording is what the panel has to show.
const pickVerification = (payload) => (payload && typeof payload === "object" ? payload : null);

export function VerificationTab() {
  const { t } = useI18n();
  const { params, notifyMsg } = useVenture();

  const ventureId = params?.id;
  const [actionError, setActionError] = useState(null);
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const notify = useCallback(
    (message, type = "success") => {
      if (typeof notifyMsg === "function") notifyMsg(message, type);
    },
    [notifyMsg],
  );

  // Server errors arrive either as a locale key ("errors.notFound") or as a
  // message; keys that resolve nowhere fall back to a local label so the panel
  // never shows a raw key.
  const messageFor = useCallback(
    (raw, fallbackKey) => {
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) return t(fallbackKey);
      const translated = t(value);
      if (translated !== value) return translated;
      return value.includes(" ") ? value : t(fallbackKey);
    },
    [t],
  );

  // The verification payload, read through the shared hook: it owns the cache,
  // the cache-first paint and the discarding of a stale answer, so the panel
  // keeps no copy of its own. The actions below re-read through `refresh`,
  // which bypasses the cache so the payload reflects the action just made.
  //
  // `no-store` on the request itself, which is what this read asked for before it
  // went through the hook: the documents are private and their links are
  // short-lived, so the browser must not keep a copy of the answer. The hook's own
  // short-lived copy still applies, as it does everywhere else.
  const { data, loading, error: readError, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/verification` : null,
    {
      defaultValue: null,
      transform: pickVerification,
      deps: [ventureId],
      fetchOptions: { cache: "no-store" },
    },
  );

  // A refusal arrives as a payload rather than as a failed request, so it has to
  // be read from the payload; the hook reports only a request that never
  // answered. Both are shown as the same failure, with the server's own wording
  // whenever there is one.
  const error = !ventureId
    ? t("vadmin.verification.loadVerificationFailed")
    : readError
      ? messageFor(readError, "vadmin.verification.loadVerificationFailed")
      : data?.success === false
        ? messageFor(data.error, "vadmin.verification.loadVerificationFailed")
        : null;

  const post = useCallback(
    async (payload) => {
      const res = await fetch(`/api/ventures/${ventureId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.json().catch(() => ({}));
    },
    [ventureId],
  );

  const runAction = useCallback(
    async (work, fallbackKey) => {
      setActionError(null);
      try {
        const result = await work();
        if (!result?.success) throw new Error(messageFor(result?.error, fallbackKey));
        await refresh();
        return result;
      } catch (caughtError) {
        setActionError(caughtError?.message || t(fallbackKey));
        return null;
      }
    },
    [refresh, messageFor, t],
  );

  // Documents live in a PRIVATE bucket: the multipart upload returns the
  // storage PATH (never a public URL) for upload_document to record; the read
  // path mints a short-lived signed URL from it.
  const handleUpload = async (category, file) => {
    if (!file || !ventureId) return;
    setUploadingCategory(category);
    const result = await runAction(async () => {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      const uploadRes = await fetch(`/api/ventures/${ventureId}/verification/upload`, {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.success || !uploadData?.path) {
        throw new Error(messageFor(uploadData?.error, "vadmin.verification.uploadFailed"));
      }
      return post({
        action: "upload_document",
        category,
        document_type: file.name.split(".").pop(),
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_url: uploadData.path,
      });
    }, "vadmin.verification.uploadFailed");
    if (result) notify(t("vadmin.verification.documentUploaded"));
    setUploadingCategory(null);
  };

  const handleDeleteDocument = async (documentId) => {
    if (!ventureId) return;
    setDeletingDoc(documentId);
    const result = await runAction(
      () => post({ action: "delete_document", document_id: documentId }),
      "venture.manager.actionFailed",
    );
    if (result) notify(t("vadmin.verification.documentRemoved"));
    setDeletingDoc(null);
  };

  const runSubmission = async (action) => {
    if (!ventureId) return;
    const fallbackKey =
      action === "resubmit" ? "vadmin.verification.resubmissionFailed" : "vadmin.verification.submissionFailed";
    setSubmitting(true);
    const result = await runAction(() => post({ action }), fallbackKey);
    if (result) {
      notify(t(action === "resubmit" ? "vadmin.verification.resubmitted" : "vadmin.verification.submittedForReview"));
    }
    setSubmitting(false);
  };

  const handleSendComment = async () => {
    const message = comment.trim();
    if (!message || !ventureId) return;
    setSendingComment(true);
    const result = await runAction(
      () => post({ action: "add_comment", author_type: "founder", message }),
      "venture.manager.actionFailed",
    );
    if (result) {
      setComment("");
      notify(t("vadmin.verification.commentAdded"));
    }
    setSendingComment(false);
  };

  const verification = data?.verification || null;
  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);
  const documents = useMemo(() => (Array.isArray(data?.documents) ? data.documents : []), [data]);
  const comments = useMemo(() => (Array.isArray(data?.comments) ? data.comments : []), [data]);
  const hasData = Boolean(verification) || items.length > 0;

  // Same rule the server enforces on submit (src/lib/ventures.js): every
  // category but email/phone needs at least one document.
  const stillRequired = useMemo(
    () =>
      VERIFICATION_STEPS.filter((step) => {
        if (step.key === "email_verification" || step.key === "phone_verification") return false;
        const item = items.find((stepItem) => stepItem.category === step.key);
        if (item?.status === "not_applicable") return false;
        return !documents.some((doc) => doc.category === step.key);
      }).map((step) => t(step.label)),
    [items, documents, t],
  );

  const statusConfig = VERIFICATION_STATUS[verification?.status] || VERIFICATION_STATUS.draft;

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center space-y-3">
        <AlertTriangle size={24} className="mx-auto text-rose-500" />
        <p className="text-[11px] text-[var(--text-secondary)] break-words">{error}</p>
        <button
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw size={13} /> {t("participant.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <Shield size={14} className="text-[var(--brand-orange)]" />
          {t("vadmin.verification.progress")}
        </h2>
        {verification && (
          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${statusConfig.cls}`}>{t(statusConfig.label)}</span>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-[var(--text-primary)] break-words">{actionError}</p>
        </div>
      )}

      {/* Review outcome — read-only, no decision controls */}
      {verification?.reviewer_notes && (
        <div className="rounded-xl border border-[var(--border-primary)] bg-surface-2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
            {t("vadmin.verification.review")}
          </p>
          <p className="text-[11px] text-[var(--text-primary)] break-words">
            {verification.status === "rejected"
              ? t("venture.manager.changesRequestedReason", { reason: verification.reviewer_notes })
              : verification.reviewer_notes}
          </p>
        </div>
      )}

      {!hasData ? (
        <div className="card text-center">
          <FileText size={20} className="mx-auto mb-2 text-[var(--text-secondary)]" />
          <p className="text-[11px] text-[var(--text-secondary)]">{t("venture.verificationTab.noItems")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stillRequired.length > 0 && verification?.status !== "verified" && (
            <p className="text-[10px] text-[var(--text-secondary)]">
              {t("venture.verificationTab.stillRequired", { items: stillRequired.join(", ") })}
            </p>
          )}

          {VERIFICATION_STEPS.map((step) => {
            const item = items.find((stepItem) => stepItem.category === step.key);
            const stepDocs = documents.filter((doc) => doc.category === step.key);
            const StepIcon = step.icon;
            const isUploading = uploadingCategory === step.key;
            const isEmailOrPhone = step.key === "email_verification" || step.key === "phone_verification";
            const itemConfig = ITEM_STATUS[item?.status] || ITEM_STATUS.pending;

            return (
              <div key={step.key} className="rounded-xl p-4 border border-[var(--border-primary)] bg-surface-2">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <StepIcon size={14} className="text-[var(--brand-orange)]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                      {t(step.label)}
                    </span>
                  </div>
                  {item && (
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${itemConfig.cls}`}>
                      {t(itemConfig.label)}
                    </span>
                  )}
                </div>

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
                      {stepDocs.map((doc) => {
                        const href = documentHref(doc);
                        return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-primary)] bg-surface-3 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={12} className="text-[var(--brand-orange)] shrink-0" />
                            <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">{doc.file_name}</span>
                            {doc.file_size ? (
                              <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
                                ({(doc.file_size / 1024).toFixed(0)} KB)
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {href && (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                title={t("common.view")}
                                className="p-1 text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/10 rounded"
                              >
                                <Download size={12} />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              disabled={deletingDoc === doc.id}
                              title={t("venture.verificationTab.deleteDocument")}
                              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded shrink-0 disabled:opacity-30"
                            >
                              {deletingDoc === doc.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stepDocs.length === 0 && isEmailOrPhone && (
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {step.key === "email_verification"
                      ? t("vadmin.verification.emailVerifiedViaLink")
                      : t("vadmin.verification.phoneVerifiedViaSms")}
                  </p>
                )}

                {stepDocs.length === 0 && !isEmailOrPhone && (
                  <p className="text-[10px] text-[var(--text-secondary)]">{t("venture.verificationTab.missingDocuments")}</p>
                )}

                {!isEmailOrPhone && item?.status !== "verified" && (
                  <label className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] hover:brightness-110 transition-all">
                    {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {isUploading ? t("vadmin.verification.uploading") : t("vadmin.verification.upload")}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(event) => {
                        if (event.target.files[0]) handleUpload(step.key, event.target.files[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Founder actions — submit / resubmit only */}
      {verification && (
        <div className="flex flex-wrap gap-3">
          {(verification.status === "draft" || verification.status === "rejected") && (
            <button
              onClick={() => runSubmission(verification.status === "rejected" ? "resubmit" : "submit")}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-[var(--brand-orange)] text-white hover:brightness-110 transition-all disabled:opacity-30"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {verification.status === "rejected"
                ? t("vadmin.verification.resubmitForReview")
                : t("vadmin.verification.submitForReview")}
            </button>
          )}
          {verification.status === "pending_review" && (
            <span className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400">
              <Clock size={14} /> {t("vadmin.verification.pendingReviewerAction")}
            </span>
          )}
          {verification.status === "verified" && (
            <span className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={14} /> {t("vadmin.verification.allVerified")}
            </span>
          )}
        </div>
      )}

      {/* Comments — read-only list plus the founder's own additions */}
      <div className="rounded-xl p-4 border border-[var(--border-primary)] bg-surface-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2 mb-3">
          <MessageCircle size={13} className="text-[var(--brand-orange)]" /> {t("vadmin.verification.comments")}
        </h3>
        {comments.length === 0 && (
          <p className="text-[11px] text-[var(--text-secondary)] mb-3">{t("vadmin.verification.noCommentsYet")}</p>
        )}
        <div className="space-y-2 mb-3">
          {comments.map((commentEntry, index) => {
            const fromReviewer = Boolean(commentEntry.author_type) && commentEntry.author_type !== "founder" && commentEntry.author_type !== "system";
            return (
              <div
                key={commentEntry.id || index}
                className={`rounded-xl border p-3 ${
                  fromReviewer ? "border-amber-500/30 bg-amber-500/5" : "border-[var(--border-primary)] bg-surface-3"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{commentEntry.author_name || commentEntry.author_cid}</span>
                  {commentEntry.author_type === "system" && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                      {t("vadmin.verification.system")}
                    </span>
                  )}
                  {fromReviewer && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                      {t("venture.verificationTab.fromReviewer")}
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-secondary)] ml-auto">
                    {new Date(commentEntry.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] break-words">{commentEntry.message}</p>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("vadmin.verification.addCommentPlaceholder")}
            className="flex-1 rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none border border-[var(--border-primary)] bg-[var(--bg-primary)] focus:border-[var(--brand-orange)] transition-colors"
          />
          <button
            onClick={handleSendComment}
            disabled={!comment.trim() || sendingComment}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-[var(--brand-orange)] text-white hover:brightness-110 transition-all disabled:opacity-30"
          >
            {sendingComment ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {t("vadmin.verification.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
