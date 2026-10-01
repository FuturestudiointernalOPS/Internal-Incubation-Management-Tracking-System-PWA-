"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Shield,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { DEFAULT_VENTURE_DOCUMENT_TYPES } from "@/lib/ventureDocumentTypeDefaults";
import { documentTypeIcon, documentTypeName, isUploadDocumentType } from "@/components/ventures/documentTypeMeta";
import DataBankDocumentRow from "@/components/ventures/DataBankDocumentRow";

/**
 * LEAD MANAGER → one Venture → the Data bank (verification).
 *
 * The founder files the compliance documents and submits them; the sign-off
 * belongs to whoever leads the whole Venture — the Super Admin (whose own
 * screen is /admin/ventures/[id]/verification) or, here, its Lead Manager.
 * `canReview` is decided by the caller from the viewer's own assignments and the
 * server re-checks it on the write, so a read-only viewer never sees a control
 * that would be refused.
 *
 * Documents carry the same actions everywhere (view / download / versions /
 * delete), through the shared row — a Lead Manager reviews the file rather than
 * replacing it, so version uploads stay with the founder.
 */

const STATUS_CONFIG = {
  draft: { label: "vadmin.verification.statusDraft", cls: "bg-slate-500/10 text-slate-400" },
  pending_review: { label: "vadmin.verification.statusPendingReview", cls: "bg-amber-500/15 text-amber-400" },
  verified: { label: "vadmin.verification.statusVerified", cls: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "vadmin.verification.statusRejected", cls: "bg-rose-500/15 text-rose-400" },
  suspended: { label: "vadmin.verification.statusSuspended", cls: "bg-red-500/15 text-red-400" },
};

const pickDocumentTypes = (payload) => (payload?.success ? payload.document_types || [] : null);

export default function DataBankPanel({ ventureId, canReview = false }) {
  const { t, lang } = useI18n();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDecision, setReviewDecision] = useState("verified");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const { data, loading, error: readError, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/verification` : null,
    {
      defaultValue: null,
      transform: (payload) => (payload && typeof payload === "object" ? payload : null),
      deps: [ventureId],
      fetchOptions: { cache: "no-store" },
    },
  );

  const { data: configuredDocumentTypes } = useApi(
    ventureId ? `/api/ventures/${ventureId}/document-types` : null,
    {
      defaultValue: null,
      transform: pickDocumentTypes,
      deps: [ventureId],
    },
  );
  const documentTypes = Array.isArray(configuredDocumentTypes)
    ? configuredDocumentTypes
    : DEFAULT_VENTURE_DOCUMENT_TYPES;

  const verification = data?.verification || null;
  const items = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data]);
  const documents = useMemo(() => (Array.isArray(data?.documents) ? data.documents : []), [data]);
  const comments = useMemo(() => (Array.isArray(data?.comments) ? data.comments : []), [data]);
  const statusConfig = STATUS_CONFIG[verification?.status] || STATUS_CONFIG.draft;
  const error = readError || (data?.success === false ? data.error : null);

  const handleReview = async () => {
    setReviewing(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/verification/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewDecision, notes: reviewNotes }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t("vadmin.verification.reviewFailed"));
      setReviewOpen(false);
      setReviewNotes("");
      await refresh();
    } catch (caughtError) {
      setActionError(caughtError?.message || t("vadmin.verification.reviewFailed"));
    } finally {
      setReviewing(false);
    }
  };

  const handleSendComment = async () => {
    const message = comment.trim();
    if (!message) return;
    setSendingComment(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The author type is derived from the session server-side — never sent.
        body: JSON.stringify({ action: "add_comment", message }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || t("venture.manager.actionFailed"));
      setComment("");
      await refresh();
    } catch (caughtError) {
      setActionError(caughtError?.message || t("venture.manager.actionFailed"));
    } finally {
      setSendingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-8">
        <Loader2 className="animate-spin mx-auto text-[var(--brand-orange)]" size={22} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center space-y-3">
        <AlertTriangle size={22} className="mx-auto text-rose-500" />
        <p className="text-[11px] text-[var(--text-secondary)] break-words">{error}</p>
        <button
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw size={13} /> {t("common.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
          <Shield size={14} className="text-[var(--brand-orange)]" />
          {t("venture.verification")}
        </h2>
        <div className="flex items-center gap-2">
          {verification && (
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${statusConfig.cls}`}>
              {t(statusConfig.label)}
            </span>
          )}
          {canReview && verification?.status === "pending_review" && (
            <button
              onClick={() => setReviewOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[var(--brand-orange)] text-white hover:brightness-110 transition-all"
            >
              <Shield size={13} /> {t("vadmin.verification.review")}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-[var(--text-primary)] break-words">{actionError}</p>
        </div>
      )}

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

      {verification?.status === "pending_review" && (
        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400">
          <Clock size={14} /> {t("vadmin.verification.pendingReviewerAction")}
        </span>
      )}

      {documentTypes.length === 0 ? (
        <div className="card text-center">
          <p className="text-[11px] text-[var(--text-secondary)]">{t("venture.verificationTab.noItems")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documentTypes.map((documentType) => {
            const stepKey = documentType.code;
            const item = items.find((stepItem) => stepItem.category === stepKey);
            const stepDocs = documents.filter((doc) => doc.category === stepKey);
            const StepIcon = documentTypeIcon(stepKey);
            const isUpload = isUploadDocumentType(documentType);
            return (
              <div key={stepKey} className="rounded-xl p-4 border border-[var(--border-primary)] bg-surface-2">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <StepIcon size={14} className="text-[var(--brand-orange)]" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                      {documentTypeName(documentType, lang, t)}
                    </span>
                  </div>
                  {item?.notes && (
                    <span
                      className="text-[10px] text-[var(--text-secondary)] max-w-[220px] truncate"
                      title={item.notes}
                    >
                      {item.status === "rejected"
                        ? t("venture.manager.changesRequestedReason", { reason: item.notes })
                        : item.notes}
                    </span>
                  )}
                </div>

                {documentType.description && (
                  <p className="text-[10px] text-[var(--text-secondary)] mb-2 break-words">{documentType.description}</p>
                )}

                {stepDocs.length > 0 ? (
                  <div className="space-y-1.5">
                    {stepDocs.map((doc) => (
                      <DataBankDocumentRow
                        key={doc.id}
                        ventureId={ventureId}
                        doc={doc}
                        onChanged={() => refresh()}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {isUpload
                      ? t("venture.verificationTab.missingDocuments")
                      : stepKey === "email_verification"
                        ? t("vadmin.verification.emailVerifiedViaLink")
                        : stepKey === "phone_verification"
                          ? t("vadmin.verification.phoneVerifiedViaSms")
                          : t("venture.verificationTab.confirmedAnotherWay")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Comments — reviewers and the Venture exchange notes on the submission */}
      <div className="rounded-xl p-4 border border-[var(--border-primary)] bg-surface-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2 mb-3">
          <MessageCircle size={13} className="text-[var(--brand-orange)]" /> {t("vadmin.verification.comments")}
        </h3>
        {comments.length === 0 && (
          <p className="text-[11px] text-[var(--text-secondary)] mb-3">{t("vadmin.verification.noCommentsYet")}</p>
        )}
        <div className="space-y-2 mb-3">
          {comments.map((commentEntry, index) => {
            const fromReviewer =
              Boolean(commentEntry.author_type) &&
              commentEntry.author_type !== "founder" &&
              commentEntry.author_type !== "system";
            return (
              <div
                key={commentEntry.id || index}
                className={`rounded-xl border p-3 ${
                  fromReviewer ? "border-amber-500/30 bg-amber-500/5" : "border-[var(--border-primary)] bg-surface-3"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">
                    {commentEntry.author_name || commentEntry.author_cid}
                  </span>
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

      {/* Review modal — approve or reject the submission */}
      {reviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setReviewOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-6 space-y-5 max-h-[85vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                <Shield size={14} className="text-[var(--brand-orange)]" />
                {t("vadmin.verification.reviewVerification")}
              </h2>
              <button
                onClick={() => setReviewOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-secondary)]"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">
                {t("vadmin.verification.decision")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "verified", label: "vadmin.verification.approve", icon: CheckCircle2, cls: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" },
                  { value: "rejected", label: "vadmin.verification.reject", icon: X, cls: "border-rose-500/30 text-rose-400 bg-rose-500/10" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setReviewDecision(option.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider ${
                      reviewDecision === option.value
                        ? `${option.cls} ring-2 ring-[var(--brand-orange)]/40`
                        : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]/30"
                    }`}
                  >
                    <option.icon size={18} />
                    {t(option.label)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">
                {t("vadmin.verification.notesOptional")}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                rows={3}
                placeholder={t("vadmin.verification.reviewNotesPlaceholder")}
                className="w-full rounded-xl px-3 py-2.5 text-[11px] text-[var(--text-primary)] outline-none border border-[var(--border-primary)] bg-[var(--bg-primary)] focus:border-[var(--brand-orange)] transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setReviewOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:bg-white/5 transition-all"
              >
                {t("vadmin.verification.cancel")}
              </button>
              <button
                onClick={handleReview}
                disabled={reviewing}
                className="flex-1 py-2.5 rounded-xl bg-[var(--brand-orange)] text-white text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {reviewing ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                {reviewing ? t("vadmin.verification.processing") : t("vadmin.verification.submitReview")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
