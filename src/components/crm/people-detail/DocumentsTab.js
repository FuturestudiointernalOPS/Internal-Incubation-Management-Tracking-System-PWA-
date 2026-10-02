"use client";

import { Upload } from "lucide-react";
import { formatLocaleDate } from "@/lib/constants";

/**
 * Documents tab — the upload control and the attached-document timeline.
 */
export default function DocumentsTab({ uploading, onFileUpload, events, t, lang }) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl cursor-pointer w-fit">
        <Upload className="w-3.5 h-3.5" />
        {uploading ? t("crm.people.uploading") : t("crm.people.uploadFile")}
        <input type="file" className="hidden" onChange={onFileUpload} disabled={uploading} />
      </label>
      <div className="space-y-2">
        {events.filter(event => event.event_type === "document_attached").map(documentEvent => (
          <div key={documentEvent.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">{documentEvent.description}</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                {formatLocaleDate(documentEvent.created_at, { month: "short", day: "numeric" }, lang)}
              </p>
            </div>
            {documentEvent.metadata?.file_url && (
              <a href={documentEvent.metadata.file_url} target="_blank" className="text-[10px] font-bold text-[var(--brand-orange)] uppercase" rel="noreferrer">
                {t("crm.people.download")}
              </a>
            )}
          </div>
        ))}
        {events.filter(event => event.event_type === "document_attached").length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] py-4">{t("crm.people.noDocuments")}</p>
        )}
      </div>
    </div>
  );
}
