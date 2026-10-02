"use client";

import {
  Video,
  FileText,
  Trash2,
  Pencil,
  Star,
  ExternalLink,
  Sparkles,
  Paperclip,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import { formatFileSize } from "@/models/lms/constants";

/**
 * One resource row: link, optional recommendation, optional pending marker.
 * Extracted verbatim from SectionResourcesEditor.
 */
export default function ResourceRow({ resource, canEdit, onEdit, onDelete }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const pending = !!resource.localId;
  return (
    <div
      className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-primary"
      style={{ borderColor: "var(--border-primary)" }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          {resource.kind === "video" ? (
            <Video className="w-4 h-4 text-blue-500" />
          ) : resource.source === "upload" ? (
            <Paperclip className="w-4 h-4 text-blue-500" />
          ) : (
            <FileText className="w-4 h-4 text-blue-500" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-black uppercase tracking-tight truncate hover:underline flex items-center gap-1"
              style={{ color: "var(--text-primary)" }}
            >
              {resource.title}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
            {resource.is_recommended && (
              <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                <Star className="w-2.5 h-2.5" />
                {t("lms.sessionResources.recommended")}
              </span>
            )}
            {pending && (
              <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border border-[var(--border-primary)]" style={{ color: "var(--text-tertiary)" }}>
                {t("lms.sessionResources.unsaved")}
              </span>
            )}
            <span
              className="text-[8px] font-bold uppercase tracking-widest"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t(`lms.sessionResources.kind.${resource.kind}`)}
            </span>
            {resource.source === "upload" && (
              <span
                className="text-[8px] font-bold uppercase tracking-widest"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t("lms.sessionResources.uploaded")}
                {resource.file_size ? ` · ${formatFileSize(resource.file_size)}` : ""}
              </span>
            )}
          </div>
          {resource.source === "upload" && resource.file_name && (
            <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>
              {resource.file_name}
            </p>
          )}
          {resource.description && (
            <p className="text-[10px] mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
              {resource.description}
            </p>
          )}
          {resource.is_recommended && resource.recommendation_note && (
            <p className="text-[10px] mt-1 italic flex items-start gap-1 text-amber-500">
              <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{resource.recommendation_note}</span>
            </p>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: "var(--text-tertiary)" }}
            title={t("lms.sessionResources.edit")}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await confirm({ message: t("lms.sessionResources.confirmDelete"), tone: "danger" })) onDelete();
            }}
            className="p-1.5 rounded-lg text-rose-500/40 hover:text-rose-500 transition-all"
            title={t("lms.sessionResources.delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
