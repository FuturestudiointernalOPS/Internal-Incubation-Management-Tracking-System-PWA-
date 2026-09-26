"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Upload,
  Trash2,
  Send,
  X,
  FileText,
  Download,
  MessageCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet, useApi } from "@/lib/hooks/useApi";
import { DEFAULT_VENTURE_DOCUMENT_TYPES } from "@/lib/ventureDocumentTypeDefaults";
import { documentTypeIcon, documentTypeName, isUploadDocumentType } from "@/components/ventures/documentTypeMeta";

// The documents the Data bank asks for are CONFIGURED (Super Admin / Lead
// Manager, see /admin/ventures/document-types) and read from the API below; the
// six built-in types are the fallback for a read that cannot be served.

// Module-scope reader — the reading hook keys its internal work on it.
// A refused (or unreadable) answer resolves to null, which the screen reads as
// "the list could not be loaded" and falls back to the built-in types; a
// SUCCESSFUL empty list is an answer too — the administrator turned every type
// off — and renders no sections at all.
const pickDocumentTypes = (payload) =>
  payload?.success ? payload.document_types || [] : null;

const STATUS_CONFIG = {
  draft: { label: "vadmin.verification.statusDraft", color: "text-slate-400 bg-slate-500/10", dot: "bg-slate-400" },
  pending_review: { label: "vadmin.verification.statusPendingReview", color: "text-amber-400 bg-amber-500/10", dot: "bg-amber-400" },
  verified: { label: "vadmin.verification.statusVerified", color: "text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400" },
  rejected: { label: "vadmin.verification.statusRejected", color: "text-rose-400 bg-rose-500/10", dot: "bg-rose-400" },
  suspended: { label: "vadmin.verification.statusSuspended", color: "text-red-400 bg-red-500/10", dot: "bg-red-400" },
};

const ITEM_STATUS_CONFIG = {
  pending: { label: "vadmin.verification.itemStatusPending", color: "text-slate-400 bg-slate-500/10" },
  under_review: { label: "vadmin.verification.itemStatusUnderReview", color: "text-amber-400 bg-amber-500/10" },
  verified: { label: "vadmin.verification.statusVerified", color: "text-emerald-400 bg-emerald-500/10" },
  rejected: { label: "vadmin.verification.statusRejected", color: "text-rose-400 bg-rose-500/10" },
  not_applicable: { label: "vadmin.verification.itemStatusNotApplicable", color: "text-slate-500 bg-slate-500/5" },
};

// Documents are private: prefer the short-lived signed URL minted by the read
// path, and fall back to the raw value only when it is an external link
// (pasted links carry no storage path and need no signature).
const documentHref = (documentEntry) => {
  if (documentEntry?.file_url_signed) return documentEntry.file_url_signed;
  const raw = String(documentEntry?.file_url || "").trim();
  return /^https?:\/\//i.test(raw) ? raw : null;
};

export default function VentureVerificationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t, lang } = useI18n();

  const [venture, setVenture] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState({});
  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewDecision, setReviewDecision] = useState("verified");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // The document types THIS Venture's Data bank asks for. An unreadable answer
  // falls back to the six built-in types rather than rendering no sections at
  // all; an EMPTY list is a real answer (every type turned off) and renders
  // exactly that.
  const { data: configuredDocumentTypes } = useApi(
    id ? `/api/ventures/${id}/document-types` : null,
    {
      defaultValue: null,
      transform: pickDocumentTypes,
      deps: [id],
    },
  );
  const documentTypes = Array.isArray(configuredDocumentTypes)
    ? configuredDocumentTypes
    : DEFAULT_VENTURE_DOCUMENT_TYPES;

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Server errors arrive either as a locale key ("errors.notFound") or as a
  // message; keys that resolve nowhere fall back to a local label.
  const messageFor = (raw, fallbackKey) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return t(fallbackKey);
    const translated = t(value);
    if (translated !== value) return translated;
    return value.includes(" ") ? value : t(fallbackKey);
  };

  // `id` is fixed for the route's lifetime; `t` changes only on a language
  // switch, which legitimately re-runs the fetch so stored error strings are
  // re-translated.
  const fetchData = useCallback(async (bypassCache = false) => {
    const urls = [`/api/ventures/${id}`, `/api/ventures/${id}/verification`];
    const apply = (vData, verData) => {
      if (!vData.success) throw new Error(t((vData.error || t("vadmin.verification.loadVentureFailed")) || "") || (vData.error || t("vadmin.verification.loadVentureFailed")));
      if (!verData.success) throw new Error(t((verData.error || t("vadmin.verification.loadVerificationFailed")) || "") || (verData.error || t("vadmin.verification.loadVerificationFailed")));
      setVenture(vData.venture);
      setData(verData);
    };
    let painted = false;
    setLoading(true);
    setError(null);
    try {
      // Cache-first paint: returning to this page renders instantly from
      // fresh snapshots; mutation flows pass bypassCache=true so the data
      // always reflects the last action.
      if (!bypassCache) {
        const cached = urls.map((url) => cacheGet(url));
        if (cached.every((snapshot) => snapshot !== null && snapshot.success)) {
          apply(cached[0], cached[1]);
          setLoading(false);
          painted = true;
        }
      }
      const [vRes, verRes] = await Promise.all([fetch(urls[0]), fetch(urls[1])]);
      const vData = await vRes.json();
      const verData = await verRes.json();
      if (vData.success) cacheSet(urls[0], vData);
      if (verData.success) cacheSet(urls[1], verData);
      apply(vData, verData);
    } catch (error) {
      if (!painted) setError(t(error.message || "") || error.message);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  // Mount fetch. The call is deferred by one microtask so the effect body
  // performs no synchronous state write (react-hooks/set-state-in-effect); the
  // writes still land before the next paint, exactly as before.
  useEffect(() => {
    Promise.resolve().then(() => fetchData());
  }, [fetchData]);

  const getStatusBadge = (status) => {
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${statusConfig.color} flex items-center gap-1.5 w-fit`}>
        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
        {t(statusConfig.label)}
      </span>
    );
  };

  const getItemStatusBadge = (status) => {
    const itemStatusConfig = ITEM_STATUS_CONFIG[status] || ITEM_STATUS_CONFIG.pending;
    return <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${itemStatusConfig.color}`}>{t(itemStatusConfig.label)}</span>;
  };

  const handleUpload = async (category, file) => {
    if (!file) return;
    setUploading((previous) => ({ ...previous, [category]: true }));
    try {
      // Documents live in a PRIVATE bucket: the multipart upload returns the
      // storage PATH (never a public URL) for upload_document to record; the
      // read path mints a short-lived signed URL from it.
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      const uploadRes = await fetch(`/api/ventures/${id}/verification/upload`, { method: "POST", body: form });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.success || !uploadData?.path) {
        throw new Error(messageFor(uploadData?.error, "vadmin.verification.uploadFailed"));
      }

      const registerRes = await fetch(`/api/ventures/${id}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_document",
          category,
          document_type: file.name.split(".").pop(),
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          file_url: uploadData.path,
        }),
      });
      const registerData = await registerRes.json().catch(() => ({}));
      if (!registerRes.ok || !registerData?.success) {
        throw new Error(messageFor(registerData?.error, "vadmin.verification.uploadFailed"));
      }

      notify(t("vadmin.verification.documentUploaded"));
      fetchData(true);
    } catch (error) {
      notify(error?.message || t("vadmin.verification.uploadFailed"), "error");
    } finally {
      setUploading((previous) => ({ ...previous, [category]: false }));
    }
  };

  const handleDeleteDoc = async (docId) => {
    await fetch(`/api/ventures/${id}/verification`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_document", document_id: docId }),
    });
    notify(t("vadmin.verification.documentRemoved"));
    fetchData(true);
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch(`/api/ventures/${id}/verification`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const result = await response.json();
      if (result.success) { notify(t("vadmin.verification.submittedForReview")); fetchData(true); }
      else { notify(t((result.error || t("vadmin.verification.submissionFailed")) || "") || (result.error || t("vadmin.verification.submissionFailed")), "error"); }
    } catch { notify(t("vadmin.verification.networkError"), "error"); }
  };

  const handleResubmit = async () => {
    try {
      const response = await fetch(`/api/ventures/${id}/verification`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resubmit" }),
      });
      const result = await response.json();
      if (result.success) { notify(t("vadmin.verification.resubmitted")); fetchData(true); }
      else { notify(t((result.error || t("vadmin.verification.resubmissionFailed")) || "") || (result.error || t("vadmin.verification.resubmissionFailed")), "error"); }
    } catch { notify(t("vadmin.verification.networkError"), "error"); }
  };

  const handleReview = async () => {
    setReviewing(true);
    try {
      const response = await fetch(`/api/ventures/${id}/verification/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewDecision, notes: reviewNotes }),
      });
      const result = await response.json();
      if (result.success) {
        notify(`Verification ${reviewDecision}`);
        setShowReviewModal(false);
        setReviewNotes("");
        fetchData(true);
      } else { notify(t((result.error || t("vadmin.verification.reviewFailed")) || "") || (result.error || t("vadmin.verification.reviewFailed")), "error"); }
    } catch { notify(t("vadmin.verification.networkError"), "error"); }
    setReviewing(false);
  };

  // Per-document review — the Super Admin validates or rejects ONE document at
  // a time (decision Q6). The same PATCH the global review uses, scoped to a
  // single item category; the global status above stays as a monitoring signal.
  const handleReviewItem = async (category, status) => {
    setReviewing(true);
    try {
      const response = await fetch(`/api/ventures/${id}/verification/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, category, notes: "" }),
      });
      const result = await response.json();
      if (result.success) {
        notify(t("vadmin.verification.reviewedItem"));
        fetchData(true);
      } else { notify(t((result.error || t("vadmin.verification.reviewFailed")) || "") || (result.error || t("vadmin.verification.reviewFailed")), "error"); }
    } catch { notify(t("vadmin.verification.networkError"), "error"); }
    setReviewing(false);
  };

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    setSendingComment(true);
    await fetch(`/api/ventures/${id}/verification`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_comment", author_type: "reviewer", message: comment.trim() }),
    });
    setComment("");
    setSendingComment(false);
    notify(t("vadmin.verification.commentAdded"));
    fetchData(true);
  };

  if (loading) return (
    <>
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    </>
  );

  if (error || !venture) return (
    <>
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t("vadmin.verification.error")}</h2>
        <p className="text-[var(--text-secondary)] mb-6">{error || t("vadmin.verification.ventureNotFound")}</p>
        <button onClick={() => router.push("/admin/ventures")} className="btn btn-primary">{t("vadmin.verification.backToVentures")}</button>
      </div>
    </>
  );

  const verification = data?.verification;
  const items = data?.items || [];
  const documents = data?.documents || [];
  const history = data?.history || [];
  const comments = data?.comments || [];
  const readiness = data?.readiness;

  const readinessState = () => {
    if (!readiness) return null;
    if (readiness.is_ready) return { label: t("vadmin.verification.ready"), cls: "text-emerald-400 bg-emerald-500/10" };
    if (readiness.readiness_percent != null) {
      return {
        label: `${t("vadmin.verification.notReady")} · ${readiness.readiness_percent}%`,
        cls: "text-rose-400 bg-rose-500/10",
      };
    }
    return { label: t("vadmin.verification.readinessUndefined"), cls: "text-slate-400 bg-slate-500/10" };
  };

  const getDocsForCategory = (category) => documents.filter((payload) => payload.category === category);
  const getItemForCategory = (category) => items.find((item) => item.category === category);

  return (
    <>
      <div className="space-y-8 pb-20">
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${
            toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
          }`}>
            {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}`)}
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
              onClick={() => router.push(`/admin/ventures/${id}/document-types`)}
              className="px-4 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2"
              title={t("venture.documentTypes.ventureHint")}
            >
              <FileText className="w-3.5 h-3.5" /> {t("venture.documentTypes.title")}
            </button>
            {verification && getStatusBadge(verification.status)}
            {verification?.status === "pending_review" && (
              <button onClick={() => setShowReviewModal(true)}
                className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> {t("vadmin.verification.review")}
              </button>
            )}
          </div>
        </div>

        {/* Readiness gauge */}
        {readiness && (
          <div className="card">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{t("vadmin.verification.readiness")}</h3>
              {(() => { const state = readinessState(); return state ? (
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded ${state.cls}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" /> {state.label}
                </span>
              ) : null; })()}
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="min-w-[120px]">
                <p className="text-4xl font-black tracking-tighter text-[var(--brand-orange)]">
                  {readiness.readiness_percent != null ? readiness.readiness_percent : "—"}
                  {readiness.readiness_percent != null && <span className="text-base font-bold text-[var(--text-tertiary)]">%</span>}
                </p>
                <p className="mt-1 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  {t("vadmin.verification.ventureReadiness")}
                </p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
                    style={{ width: `${Math.min(100, readiness.readiness_percent ?? 0)}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">✓ {readiness.verified_count}</span>
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded">✕ {readiness.rejected_count}</span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">◷ {readiness.pending_count}</span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-500/10 px-2 py-1 rounded">… {readiness.missing_count}</span>
              </div>
            </div>
          </div>
        )}

        {/* Verification Progress */}
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
                      {item && getItemStatusBadge(item.status)}
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
                      {stepDocs.map((documentEntry) => {
                        const href = documentHref(documentEntry);
                        return (
                        <div key={documentEntry.id} className="flex items-center justify-between p-2 bg-primary rounded-lg border border-[var(--border-primary)]">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3 h-3 text-[var(--brand-orange)] shrink-0" />
                            <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">{documentEntry.file_name}</span>
                            {documentEntry.file_size && <span className="text-[10px] text-[var(--text-secondary)]">({(documentEntry.file_size / 1024).toFixed(0)} KB)</span>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {href && (
                              <a href={href} target="_blank" rel="noreferrer" title={t("common.view")}
                                className="p-1 text-[var(--brand-orange)] hover:bg-brand-orange/10 rounded"><Download className="w-3 h-3" /></a>
                            )}
                            <button onClick={() => handleDeleteDoc(documentEntry.id)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded shrink-0"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Upload button (only for upload-backed, non-verified types) */}
                  {isUpload && item?.status !== "verified" && (
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-orange/10 text-[var(--brand-orange)] rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all">
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {isUploading ? t("vadmin.verification.uploading") : t("vadmin.verification.upload")}
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden"
                        disabled={isUploading}
                        onChange={(event) => { if (event.target.files[0]) handleUpload(stepKey, event.target.files[0]); event.target.value = ""; }}
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
                          onClick={() => handleReviewItem(stepKey, "verified")}
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
                          onClick={() => handleReviewItem(stepKey, "rejected")}
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
              <button onClick={verification?.status === "rejected" ? handleResubmit : handleSubmit}
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

        {/* History Timeline */}
        {history.length > 0 && (
          <div className="card">
            <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4">{t("vadmin.verification.activityTimeline")}</h3>
            <div className="space-y-3">
              {history.map((entry, index) => (
                <div key={entry.id || index} className="flex items-start gap-4 p-3 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    entry.action.includes("APPROVED") || entry.action.includes("VERIFIED") ? "bg-emerald-500/10 text-emerald-500" :
                    entry.action.includes("REJECTED") || entry.action.includes("SUSPENDED") ? "bg-rose-500/10 text-rose-500" :
                    "bg-amber-500/10 text-amber-500"
                  }`}>
                    {entry.action.includes("APPROVED") || entry.action.includes("VERIFIED") ? <CheckCircle2 className="w-4 h-4" /> :
                     entry.action.includes("REJECTED") || entry.action.includes("SUSPENDED") ? <AlertCircle className="w-4 h-4" /> :
                     <Clock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-bold text-[var(--text-primary)]">{entry.action.replace(/_/g, " ")}</p>
                      <span className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.verification.byActor", { name: entry.actor_name || t("vadmin.verification.system") })}</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{entry.previous_status} → {entry.new_status}</p>
                    {entry.notes && <p className="text-sm text-[var(--text-secondary)] mt-1">{entry.notes}</p>}
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="card">
          <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-4 flex items-center gap-2">
            <MessageCircle className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.verification.comments")}
          </h3>
          {comments.length === 0 && <p className="text-sm text-[var(--text-secondary)] mb-4">{t("vadmin.verification.noCommentsYet")}</p>}
          <div className="space-y-3 mb-4">
            {comments.map((comment, index) => (
              <div key={comment.id || index} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{comment.author_name || comment.author_cid}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500">{comment.author_type}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] ml-auto">{new Date(comment.created_at).toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)]">{comment.message}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <input type="text" value={comment} onChange={(event) => setComment(event.target.value)}
              placeholder={t("vadmin.verification.addCommentPlaceholder")}
              className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
            <button onClick={handleSendComment} disabled={!comment.trim() || sendingComment}
              className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-2">
              {sendingComment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {t("vadmin.verification.send")}
            </button>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
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
              <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
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
                      onClick={() => setReviewDecision(decisionOption.value)}
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
                <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)}
                  rows={3} placeholder={t("vadmin.verification.reviewNotesPlaceholder")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowReviewModal(false)}
                className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all">{t("vadmin.verification.cancel")}</button>
              <button onClick={handleReview} disabled={reviewing}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {reviewing ? t("vadmin.verification.processing") : t("vadmin.verification.submitReview")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
