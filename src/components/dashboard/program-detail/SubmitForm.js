"use client";

import { useState } from "react";
import { Clock, RefreshCw, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getServerErrorKey } from "@/lib/constants";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

/** The deliverable submission form: upload a file or paste a URL. */
export default function SubmitForm({ programId, deliverableId, deliverable, onDone, readOnly }) {
  const { t } = useI18n();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [url, setUrl] = useState("");

  // Who is signed in comes from the session the shell already publishes, so it
  // needs no effect and no read of its own.
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser || {};

  const handleSubmit = async () => {
    if (!file && !url.trim()) return;
    setSubmitting(true);
    try {
      let fileUrl = null;
      let supportingUrl = url.trim() || null;

      // If a file was selected, upload it
      if (file) {
        try {
          const { uploadFile } = await import("@/lib/storage");
          const result = await uploadFile(
            "submissions",
            `${programId}/${Date.now()}-${file.name}`,
            file,
          );
          if (result.success) fileUrl = result.url;
        } catch (_) {}
      }

      const body = {
        participant_id: user.cid || user.id,
        program_id: programId,
        deliverable_id: deliverableId,
        document_id: deliverableId, // Track 2 compatibility (v2_document_requirements uses integer IDs)
        file_url: fileUrl,
        supporting_url: supportingUrl,
        status: "pending",
      };
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        onDone?.();
      } else {
        const key = getServerErrorKey(data.error);
        setSubmitError(key ? t(key) : data.error || t("errors.somethingWrong"));
      }
    } catch (_) {
      setSubmitError(t("errors.networkError"));
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {readOnly && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            {t("participantMisc.programListing.viewOnly")}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("errors.programCompletedViewOnly")}
          </p>
        </div>
      )}
      {/* Deliverable Info */}
      {deliverable && (
        <div className="bg-[var(--surface-2)] rounded-lg p-3 border border-[var(--border-primary)] space-y-1">
          <p className="text-[11px] font-bold text-[var(--text-primary)]">
            {deliverable.title}
          </p>
          {deliverable.description && (
            <p className="text-sm text-[var(--text-secondary)]">
              {deliverable.description}
            </p>
          )}
          {deliverable.dueDate && (
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span className={`text-[10px] font-bold ${new Date(deliverable.dueDate) < new Date() ? 'text-rose-400' : 'text-amber-400'}`}>
                {t("participant.due")}: {new Date(deliverable.dueDate).toLocaleDateString()}
                {new Date(deliverable.dueDate) < new Date() ? ` (${t("participant.overdue")})` : ''}
              </span>
            </div>
          )}
          {deliverable.allowedFormat && (
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
              {t("participant.format")}: {deliverable.allowedFormat}
            </p>
          )}
        </div>
      )}

      {(!deliverable?.allowedFormat || ['pdf', 'image', 'document', 'file'].includes(deliverable.allowedFormat.toLowerCase())) && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("participant.uploadFile")}
          </label>
          <input
            type="file"
            onChange={(event) => setFile(event.target.files[0])}
            disabled={readOnly}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[var(--brand-orange)] file:text-black file:cursor-pointer disabled:opacity-40 text-[var(--text-primary)]"
          />
        </div>
      )}
      
      {!deliverable?.allowedFormat && (
        <div className="text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] my-2">
          — or —
        </div>
      )}
      
      {(!deliverable?.allowedFormat || ['link', 'video'].includes(deliverable.allowedFormat.toLowerCase())) && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {deliverable?.allowedFormat?.toLowerCase() === 'video' ? t("participant.videoUrl") : t("participant.urlLink")}
          </label>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={readOnly}
            placeholder="https://..."
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--brand-orange)] disabled:opacity-40 text-[var(--text-primary)]"
          />
        </div>
      )}
      {submitError && (
        <p className="text-[10px] font-bold text-rose-500 text-center">
          {submitError}
        </p>
      )}
      <button
        onClick={handleSubmit}
        disabled={submitting || readOnly || (!file && !url.trim())}
        className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {submitting ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> {t("participant.submitting")}</>
        ) : (
          <>
            <Upload className="w-4 h-4" /> {t("participant.submit")}
          </>
        )}
      </button>
    </div>
  );
}
