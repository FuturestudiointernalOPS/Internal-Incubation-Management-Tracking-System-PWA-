"use client";

import { useI18n } from "@/lib/i18n";
import { CheckCircle2, ChevronRight, Loader2, Save, Upload } from "lucide-react";

/**
 * The submit sheet: what is being answered, the file picker, or a pasted link.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function SubmitModal({
  deliverable,
  fileUrl,
  link,
  uploading,
  submitting,
  onClose,
  onFileUpload,
  onLinkChange,
  onSubmit,
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
            {t("rootMisc.team.submitDeliverable")}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-[var(--text-secondary)]"
          >
            <ChevronRight className="w-4 h-4 rotate-45" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)] mb-1">
              {deliverable.title}
            </p>
            {deliverable.description && (
              <p className="text-[10px] text-[var(--text-tertiary)]">
                {deliverable.description}
              </p>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("rootMisc.team.uploadFile")}
            </label>
            <div className="relative">
              <input
                type="file"
                onChange={onFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.jpg,.png,.mp4"
              />
              <div className="w-full bg-[var(--surface-2)] border border-dashed border-[var(--border-primary)] rounded-xl px-4 py-6 text-center hover:border-[var(--brand-orange)] transition-colors">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-orange)]" />
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      {t("rootMisc.team.uploading")}
                    </span>
                  </div>
                ) : fileUrl ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-500">
                      {t("rootMisc.team.fileUploaded")}
                    </span>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-5 h-5 text-[var(--text-tertiary)] mx-auto mb-1" />
                    <span className="text-xs font-bold text-[var(--text-tertiary)]">
                      {t("rootMisc.team.clickToUpload")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Or Link */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("rootMisc.team.orPasteLink")}
            </label>
            <input
              type="url"
              value={link}
              onChange={onLinkChange}
              placeholder="https://drive.google.com/..."
              className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60 transition-colors"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-[var(--surface-3)] transition-colors"
          >
            {t("rootMisc.team.cancel")}
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || (!fileUrl && !link)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t("rootMisc.team.submitting")}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {t("rootMisc.team.submit")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}