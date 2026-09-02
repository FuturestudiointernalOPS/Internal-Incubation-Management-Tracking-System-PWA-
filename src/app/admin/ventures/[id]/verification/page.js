"use client";

import React, { useState, useEffect } from "react";
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
  RefreshCw,
  X,
  FileText,
  Mail,
  Phone,
  Building2,
  User,
  Briefcase,
  DollarSign,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const VERIFICATION_STEPS = [
  { key: "business_registration", label: "vadmin.verification.stepBusinessRegistration", icon: Building2 },
  { key: "founder_identity", label: "vadmin.verification.stepFounderIdentity", icon: User },
  { key: "email_verification", label: "vadmin.verification.stepEmailVerification", icon: Mail },
  { key: "phone_verification", label: "vadmin.verification.stepPhoneVerification", icon: Phone },
  { key: "legal_documents", label: "vadmin.verification.stepLegalDocuments", icon: Briefcase },
  { key: "financial_documents", label: "vadmin.verification.stepFinancialDocuments", icon: DollarSign },
];

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

export default function VentureVerificationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();

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

  useEffect(() => { fetchData(); }, []);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vRes, verRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/verification`),
      ]);
      const vData = await vRes.json();
      const verData = await verRes.json();
      if (!vData.success) throw new Error(t((vData.error || t("vadmin.verification.loadVentureFailed")) || "") || (vData.error || t("vadmin.verification.loadVentureFailed")));
      if (!verData.success) throw new Error(t((verData.error || t("vadmin.verification.loadVerificationFailed")) || "") || (verData.error || t("vadmin.verification.loadVerificationFailed")));
      setVenture(vData.venture);
      setData(verData);
    } catch (e) {
      setError(t(e.message || "") || e.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${cfg.color} flex items-center gap-1.5 w-fit`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {t(cfg.label)}
      </span>
    );
  };

  const getItemStatusBadge = (status) => {
    const cfg = ITEM_STATUS_CONFIG[status] || ITEM_STATUS_CONFIG.pending;
    return <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${cfg.color}`}>{t(cfg.label)}</span>;
  };

  const handleUpload = async (category, file) => {
    if (!file) return;
    setUploading((p) => ({ ...p, [category]: true }));
    try {
      // Try Vercel Blob upload first
      let fileUrl;
      try {
        const uploadRes = await fetch("/api/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upload", file_name: file.name, file_type: file.type }),
        });
        const uploadData = await uploadRes.json();
        fileUrl = uploadData.url;
      } catch {
        fileUrl = URL.createObjectURL(file);
      }

      await fetch(`/api/ventures/${id}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload_document",
          category,
          document_type: file.name.split(".").pop(),
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          file_url: fileUrl || "pending",
        }),
      });

      notify(t("vadmin.verification.documentUploaded"));
      fetchData();
    } catch {
      notify(t("vadmin.verification.uploadFailed"), "error");
    } finally {
      setUploading((p) => ({ ...p, [category]: false }));
    }
  };

  const handleDeleteDoc = async (docId) => {
    await fetch(`/api/ventures/${id}/verification`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_document", document_id: docId }),
    });
    notify(t("vadmin.verification.documentRemoved"));
    fetchData();
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch(`/api/ventures/${id}/verification`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const result = await res.json();
      if (result.success) { notify(t("vadmin.verification.submittedForReview")); fetchData(); }
      else { notify(t((result.error || t("vadmin.verification.submissionFailed")) || "") || (result.error || t("vadmin.verification.submissionFailed")), "error"); }
    } catch { notify(t("vadmin.verification.networkError"), "error"); }
  };

  const handleResubmit = async () => {
    try {
      const res = await fetch(`/api/ventures/${id}/verification`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resubmit" }),
      });
      const result = await res.json();
      if (result.success) { notify(t("vadmin.verification.resubmitted")); fetchData(); }
      else { notify(t((result.error || t("vadmin.verification.resubmissionFailed")) || "") || (result.error || t("vadmin.verification.resubmissionFailed")), "error"); }
    } catch { notify(t("vadmin.verification.networkError"), "error"); }
  };

  const handleReview = async () => {
    setReviewing(true);
    try {
      const res = await fetch(`/api/ventures/${id}/verification/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewDecision, notes: reviewNotes }),
      });
      const result = await res.json();
      if (result.success) {
        notify(`Verification ${reviewDecision}`);
        setShowReviewModal(false);
        setReviewNotes("");
        fetchData();
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
    fetchData();
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
        <p className="text-slate-500 mb-6">{error || t("vadmin.verification.ventureNotFound")}</p>
        <button onClick={() => router.push("/admin/ventures")} className="btn btn-primary">{t("vadmin.verification.backToVentures")}</button>
      </div>
    </>
  );

  const verification = data?.verification;
  const items = data?.items || [];
  const documents = data?.documents || [];
  const history = data?.history || [];
  const comments = data?.comments || [];

  const getDocsForCategory = (cat) => documents.filter((d) => d.category === cat);
  const getItemForCategory = (cat) => items.find((i) => i.category === cat);

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
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-3">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.verification.backTo", { name: venture.company_name })}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{t("vadmin.verification.startupVerification")}</h1>
                <p className="text-xs text-slate-500 mt-0.5">{venture.company_name} · {venture.venture_id}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {verification && getStatusBadge(verification.status)}
            {verification?.status === "pending_review" && (
              <button onClick={() => setShowReviewModal(true)}
                className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> {t("vadmin.verification.review")}
              </button>
            )}
          </div>
        </div>

        {/* Verification Progress */}
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.verification.progress")}</h3>
          <div className="space-y-3">
            {VERIFICATION_STEPS.map((step) => {
              const item = getItemForCategory(step.key);
              const stepDocs = getDocsForCategory(step.key);
              const StepIcon = step.icon;
              const isUploading = uploading[step.key];
              return (
                <div key={step.key} className="p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <StepIcon className="w-4 h-4 text-[var(--brand-orange)]" />
                      <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">{t(step.label)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item && getItemStatusBadge(item.status)}
                      {item?.notes && (
                        <span className="text-[7px] text-slate-500 italic max-w-[200px] truncate" title={item.notes}>{item.notes}</span>
                      )}
                    </div>
                  </div>

                  {/* Uploaded documents */}
                  {stepDocs.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {stepDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-2 bg-primary rounded-lg border border-[var(--border-primary)]">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3 h-3 text-[var(--brand-orange)] shrink-0" />
                            <span className="text-[9px] font-bold text-[var(--text-primary)] truncate">{doc.file_name}</span>
                            {doc.file_size && <span className="text-[7px] text-slate-500">({(doc.file_size / 1024).toFixed(0)} KB)</span>}
                          </div>
                          <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded shrink-0"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button (only for non-email/phone and non-verified) */}
                  {step.key !== "email_verification" && step.key !== "phone_verification" && item?.status !== "verified" && (
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] rounded-lg text-[8px] font-black uppercase tracking-wider cursor-pointer hover:brightness-110 transition-all">
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {isUploading ? t("vadmin.verification.uploading") : t("vadmin.verification.upload")}
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden"
                        disabled={isUploading}
                        onChange={(e) => { if (e.target.files[0]) handleUpload(step.key, e.target.files[0]); e.target.value = ""; }}
                      />
                    </label>
                  )}
                  {step.key === "email_verification" && <p className="text-[8px] text-slate-500 italic">{t("vadmin.verification.emailVerifiedViaLink")}</p>}
                  {step.key === "phone_verification" && <p className="text-[8px] text-slate-500 italic">{t("vadmin.verification.phoneVerifiedViaSms")}</p>}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex gap-3">
            {verification?.status === "draft" || verification?.status === "rejected" ? (
              <button onClick={verification?.status === "rejected" ? handleResubmit : handleSubmit}
                className="px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
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
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.verification.activityTimeline")}</h3>
            <div className="space-y-3">
              {history.map((entry, i) => (
                <div key={entry.id || i} className="flex items-start gap-4 p-3 rounded-lg bg-tertiary border border-[var(--border-primary)]">
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
                      <span className="text-[8px] text-slate-500">{t("vadmin.verification.byActor", { name: entry.actor_name || t("vadmin.verification.system") })}</span>
                    </div>
                    <p className="text-[8px] text-slate-500 mt-0.5">{entry.previous_status} → {entry.new_status}</p>
                    {entry.notes && <p className="text-[9px] text-slate-600 mt-1 italic">{entry.notes}</p>}
                    <p className="text-[8px] text-slate-600 mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MessageCircle className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.verification.comments")}
          </h3>
          {comments.length === 0 && <p className="text-[10px] text-slate-500 italic mb-4">{t("vadmin.verification.noCommentsYet")}</p>}
          <div className="space-y-3 mb-4">
            {comments.map((c, i) => (
              <div key={c.id || i} className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-bold text-[var(--text-primary)]">{c.author_name || c.author_cid}</span>
                  <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500">{c.author_type}</span>
                  <span className="text-[8px] text-slate-500 ml-auto">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-[var(--text-secondary)]">{c.message}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <input type="text" value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder={t("vadmin.verification.addCommentPlaceholder")}
              className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
            <button onClick={handleSendComment} disabled={!comment.trim() || sendingComment}
              className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center gap-2">
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
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.verification.reviewVerification")}</h2>
                  <p className="text-[9px] text-slate-500">{venture.company_name}</p>
                </div>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.verification.decision")}</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: "verified", label: "vadmin.verification.approve", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20" },
                    { value: "rejected", label: "vadmin.verification.reject", icon: X, color: "bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20" },
                    { value: "suspended", label: "vadmin.verification.suspend", icon: AlertTriangle, color: "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20" },
                  ].map((opt) => (
                    <button key={opt.value}
                      onClick={() => setReviewDecision(opt.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-[9px] font-black uppercase tracking-wider ${
                        reviewDecision === opt.value ? `${opt.color} ring-2 ring-offset-1` : "bg-primary border-[var(--border-primary)] text-slate-500 hover:border-slate-500/30"
                      }`}>
                      <opt.icon className="w-5 h-5" />
                      {t(opt.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.verification.notesOptional")}</label>
                <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3} placeholder={t("vadmin.verification.reviewNotesPlaceholder")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowReviewModal(false)}
                className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all">{t("vadmin.verification.cancel")}</button>
              <button onClick={handleReview} disabled={reviewing}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
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
