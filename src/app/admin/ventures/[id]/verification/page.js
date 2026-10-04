"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet, useApi } from "@/lib/hooks/useApi";
import { DEFAULT_VENTURE_DOCUMENT_TYPES } from "@/lib/ventureDocumentTypeDefaults";
import {
  VerificationLoading,
  VerificationError,
  VerificationToast,
} from "@/components/admin/ventures/verification/VerificationScenes";
import VerificationHeader from "@/components/admin/ventures/verification/VerificationHeader";
import ReadinessGauge from "@/components/admin/ventures/verification/ReadinessGauge";
import VerificationProgress from "@/components/admin/ventures/verification/VerificationProgress";
import VerificationHistory from "@/components/admin/ventures/verification/VerificationHistory";
import VerificationComments from "@/components/admin/ventures/verification/VerificationComments";
import ReviewModal from "@/components/admin/ventures/verification/ReviewModal";

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

  if (loading) return <VerificationLoading />;

  if (error || !venture) return (
    <VerificationError
      t={t}
      message={error}
      onBack={() => router.push("/admin/ventures")}
    />
  );

  const verification = data?.verification;
  const items = data?.items || [];
  const documents = data?.documents || [];
  const history = data?.history || [];
  const comments = data?.comments || [];
  const readiness = data?.readiness;

  const getDocsForCategory = (category) => documents.filter((payload) => payload.category === category);
  const getItemForCategory = (category) => items.find((item) => item.category === category);

  return (
    <>
      <div className="space-y-8 pb-20">
        <VerificationToast toast={toast} />

        <VerificationHeader
          venture={venture}
          verification={verification}
          t={t}
          onBack={() => router.push(`/admin/ventures/${id}`)}
          onOpenDocumentTypes={() => router.push(`/admin/ventures/${id}/document-types`)}
          onOpenReview={() => setShowReviewModal(true)}
        />

        <ReadinessGauge readiness={readiness} t={t} />

        <VerificationProgress
          id={id}
          documentTypes={documentTypes}
          uploading={uploading}
          verification={verification}
          reviewing={reviewing}
          t={t}
          lang={lang}
          getItemForCategory={getItemForCategory}
          getDocsForCategory={getDocsForCategory}
          onUpload={handleUpload}
          onReviewItem={handleReviewItem}
          onReload={fetchData}
          onSubmit={handleSubmit}
          onResubmit={handleResubmit}
        />

        <VerificationHistory history={history} t={t} />

        <VerificationComments
          comments={comments}
          comment={comment}
          sendingComment={sendingComment}
          onCommentChange={setComment}
          onSend={handleSendComment}
          t={t}
        />
      </div>

      <ReviewModal
        open={showReviewModal}
        venture={venture}
        reviewDecision={reviewDecision}
        reviewNotes={reviewNotes}
        reviewing={reviewing}
        onClose={() => setShowReviewModal(false)}
        onDecisionChange={setReviewDecision}
        onNotesChange={setReviewNotes}
        onReview={handleReview}
        t={t}
      />
    </>
  );
}
