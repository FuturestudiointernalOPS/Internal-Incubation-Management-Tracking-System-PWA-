import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function PmReportNotesSection({ ctx }) {
  const { t } = useI18n();
  const { isSaving, newPMReport, onPmReportAttachments, onPmReportAttachmentsChange, onPmReportAttachmentsFile, onReportAttachmentUploadChange, onResetPmReportAttachments, onStatusChange, onSummaryChange, pmReportAttachments } = ctx;
  return (
    <>
          {/* ────────── NOTES (free text for PM) ────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-500/20">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {t("pmMisc.workspace.strategicHealthNotes")}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.strategicHealth")}
              </label>
              <select
                value={newPMReport.status}
                onChange={(event) =>
                  onStatusChange((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
                className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="optimal">
                  {t("pmMisc.workspace.healthOptimal")}
                </option>
                <option value="stable">
                  {t("pmMisc.workspace.healthStable")}
                </option>
                <option value="at_risk">
                  {t("pmMisc.workspace.healthAtRisk")}
                </option>
                <option value="critical">
                  {t("pmMisc.workspace.healthCritical")}
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.additionalNotes")}
              </label>
              <textarea
                value={newPMReport.summary}
                onChange={(event) =>
                  onSummaryChange((prev) => ({
                    ...prev,
                    summary: event.target.value,
                  }))
                }
                rows={3}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all resize-none"
                placeholder={t("pmMisc.workspace.additionalNotesPlaceholder")}
              />
            </div>

            {/* Attachment: URL link or PDF upload */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.reportAttachment")}
              </label>
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  type="button"
                  onClick={() =>
                    onPmReportAttachments((prev) => ({
                      type: "link",
                      url: prev.type === "link" ? prev.url : "",
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    pmReportAttachments.type === "link"
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                      : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                  }`}
                >
                  {t("pmMisc.workspace.attachmentLink")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onPmReportAttachmentsFile((prev) => ({
                      type: "file",
                      url: prev.type === "file" ? prev.url : "",
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    pmReportAttachments.type === "file"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                      : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                  }`}
                >
                  {t("pmMisc.workspace.attachmentPdf")}
                </button>
                {pmReportAttachments.url && (
                  <button
                    type="button"
                    onClick={() =>
                      onResetPmReportAttachments({ type: "", url: "" })
                    }
                    className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all text-[10px] font-bold uppercase tracking-widest"
                  >
                    <X className="w-3 h-3" />{" "}
                    {t("pmMisc.workspace.attachmentRemove")}
                  </button>
                )}
              </div>

              {pmReportAttachments.type === "link" && (
                <input
                  type="url"
                  value={pmReportAttachments.url}
                  onChange={(event) =>
                    onPmReportAttachmentsChange((prev) => ({
                      ...prev,
                      url: event.target.value,
                    }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all"
                  placeholder={t("pmMisc.workspace.attachmentUrlPlaceholder")}
                />
              )}

              {pmReportAttachments.type === "file" && (
                <div className="flex items-center gap-3">
                  <label className="btn btn-secondary btn-sm cursor-pointer">
                    {isSaving && !pmReportAttachments.url
                      ? t("pmMisc.workspace.attachmentUploading")
                      : t("pmMisc.workspace.attachmentChoosePdf")}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={onReportAttachmentUploadChange}
                      disabled={isSaving}
                    />
                  </label>
                  {pmReportAttachments.url && (
                    <a
                      href={pmReportAttachments.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest truncate max-w-[220px] hover:underline"
                    >
                      {t("pmMisc.workspace.attachmentUploaded")}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
    </>
  );
}
