"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2, ShieldCheck, X, XCircle } from "lucide-react";
import { Overlay, Field } from "./DataRoomUploadModal";
import { STATUS_CLASS, documentTitle, formatDateTime } from "./dataRoomUi";

/**
 * Record a reviewer's decision. Uploading and verifying are distinct acts: this
 * dialog is the only place a document becomes `verified`, and a rejection must
 * carry a reason.
 */
export default function DataRoomReviewModal({ documentEntry, ventureId, t, onClose, onDone }) {
  const [notes, setNotes] = useState(documentEntry?.review_notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const message = (value) => (String(value || "").startsWith("dataRoom.") ? t(value) : value);

  const submit = async (decision) => {
    setError(null);
    if (decision === "rejected" && !notes.trim()) {
      setError(t("dataRoom.reviewModal.rejectionRequired"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/data-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          document_id: documentEntry.id,
          decision,
          notes: notes.trim() || null,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(message(data.error));
      onDone?.();
      onClose?.();
    } catch (caughtError) {
      setError(caughtError?.message || t("dataRoom.errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const status = documentEntry?.status || "uploaded";

  return (
    <Overlay onClose={onClose} label={t("dataRoom.reviewModal.title")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck size={15} className="text-[var(--brand-orange)]" /> {t("dataRoom.reviewModal.title")}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-surface-2 p-3 space-y-1">
          <p className="text-[11px] font-bold text-[var(--text-primary)] break-words">{documentTitle(documentEntry)}</p>
          <div className="flex items-center gap-2 flex-wrap text-[10px] text-[var(--text-secondary)]">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${STATUS_CLASS[status] || STATUS_CLASS.uploaded}`}>
              {t(`dataRoom.status.${status}`)}
            </span>
            <span>v{documentEntry?.current_version || 1}</span>
            {documentEntry?.reviewed_at ? (
              <span>
                {t("dataRoom.metadata.reviewedAt")}: {formatDateTime(documentEntry.reviewed_at)}
              </span>
            ) : null}
            {documentEntry?.reviewed_version ? (
              <span>
                {t("dataRoom.metadata.reviewedVersion")}: v{documentEntry.reviewed_version}
              </span>
            ) : null}
          </div>
          {documentEntry?.reviewer_id ? (
            <p className="text-[10px] text-[var(--text-secondary)]">
              {t("dataRoom.metadata.reviewer")}: {documentEntry.reviewer_id}
            </p>
          ) : null}
        </div>

        <Field label={t("dataRoom.reviewModal.notes")}>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={t("dataRoom.reviewModal.rejectionReason")}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none resize-none"
          />
        </Field>

        {error ? <p className="text-[10px] text-rose-400 break-words">{error}</p> : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <DecisionButton
            icon={Clock}
            label={t("dataRoom.reviewModal.startReview")}
            disabled={busy}
            onClick={() => submit("under_review")}
            tone="amber"
          />
          <DecisionButton
            icon={CheckCircle2}
            label={t("dataRoom.reviewModal.verify")}
            disabled={busy}
            onClick={() => submit("verified")}
            tone="emerald"
          />
          <DecisionButton
            icon={XCircle}
            label={t("dataRoom.reviewModal.reject")}
            disabled={busy}
            onClick={() => submit("rejected")}
            tone="rose"
          />
        </div>

        {busy ? (
          <p className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> {t("dataRoom.save")}…
          </p>
        ) : null}
      </div>
    </Overlay>
  );
}

function DecisionButton({ icon: Icon, label, onClick, disabled, tone }) {
  const tones = {
    amber: "border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
    emerald: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
    rose: "border-rose-500/30 text-rose-400 hover:bg-rose-500/10",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[9px] font-bold uppercase tracking-wide disabled:opacity-40 ${tones[tone]}`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}
