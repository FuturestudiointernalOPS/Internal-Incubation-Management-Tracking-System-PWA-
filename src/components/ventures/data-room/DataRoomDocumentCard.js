"use client";

import { Download, Eye, FileText, History, Pencil, ShieldCheck, Share2, Trash2, Upload } from "lucide-react";
import { dataRoomCategory, isLegacyDocumentCategory } from "@/lib/dataRoom";
import { formatBytes, formatDate, STATUS_ACCENT, STATUS_CLASS, documentTitle } from "./dataRoomUi";

/**
 * ONE document in the Data Room.
 *
 * The card renders what a viewer may do, but never GRANTS anything: every
 * action calls the API, which re-checks the viewer. An investor sees only
 * open/download; a member with manage rights also sees replace, share and
 * delete; a reviewer additionally sees review.
 */
export default function DataRoomDocumentCard({
  documentEntry,
  t,
  canManage,
  canReview,
  onOpen,
  onVersions,
  onReplace,
  onEdit,
  onReview,
  onAccess,
  onDelete,
}) {
  const status = documentEntry.status || "uploaded";
  const category = dataRoomCategory(documentEntry.category);
  const isLegacy = isLegacyDocumentCategory(documentEntry.category);
  const href = documentEntry.file_url_signed;
  const title = documentTitle(documentEntry);

  return (
    <div className={`rounded-xl border border-[var(--border-primary)] border-l-4 ${STATUS_ACCENT[status] || STATUS_ACCENT.uploaded} bg-surface-2 p-3 space-y-2`}>
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
          <FileText size={14} className="text-[var(--brand-orange)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold text-[var(--text-primary)] break-words">{title}</p>
            <span className="flex items-center gap-1 shrink-0">
              {isLegacy && (
                // A document filed before the Data Room existed: its category is
                // not one of the eleven. It is kept and shown — never hidden —
                // and it does not count toward completeness until someone
                // re-files it with the Edit action.
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400">
                  {t("dataRoom.legacy.badge")}
                </span>
              )}
              <span className={`uppercase tracking-wide !text-[10.5px] ${STATUS_CLASS[status] || STATUS_CLASS.uploaded}`}>
                {t(`dataRoom.status.${status}`)}
              </span>
            </span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            {category ? t(category.labelKey) : documentEntry.category}
            {isLegacy ? ` · ${t("dataRoom.legacy.hint")}` : ""}
            {documentEntry.current_version ? ` · v${documentEntry.current_version}` : ""}
            {formatBytes(documentEntry.file_size) ? ` · ${formatBytes(documentEntry.file_size)}` : ""}
            {formatDate(documentEntry.created_at) ? ` · ${formatDate(documentEntry.created_at)}` : ""}
          </p>
        </div>
      </div>

      {documentEntry.description ? (
        <p className="text-[10px] text-[var(--text-secondary)] break-words">{documentEntry.description}</p>
      ) : null}

      {documentEntry.review_notes ? (
        <p className="text-[10px] text-amber-400/90 break-words">
          {t("dataRoom.metadata.reviewNotes")}: {documentEntry.review_notes}
        </p>
      ) : null}

      {documentEntry.expires_at ? (
        <p className="text-[10px] text-[var(--text-secondary)]">
          {t("dataRoom.metadata.expires")}: {formatDate(documentEntry.expires_at)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {href ? (
          <>
            <ActionButton icon={Eye} label={t("dataRoom.view")} onClick={() => onOpen(documentEntry, "view")} />
            <ActionButton icon={Download} label={t("dataRoom.download")} onClick={() => onOpen(documentEntry, "download")} />
          </>
        ) : (
          <span className="text-[10px] text-[var(--text-secondary)]">—</span>
        )}
        <ActionButton icon={History} label={t("dataRoom.versions")} onClick={() => onVersions(documentEntry)} />
        {canManage ? (
          <>
            <ActionButton icon={Upload} label={t("dataRoom.replaceVersion")} onClick={() => onReplace(documentEntry)} />
            <ActionButton icon={Share2} label={t("dataRoom.shareAccess")} onClick={() => onAccess(documentEntry)} />
            <ActionButton icon={Pencil} label={t("dataRoom.editDetails")} onClick={() => onEdit(documentEntry)} />
            <ActionButton icon={Trash2} label={t("dataRoom.delete")} danger onClick={() => onDelete(documentEntry)} />
          </>
        ) : null}
        {canReview ? (
          <ActionButton icon={ShieldCheck} label={t("dataRoom.review")} onClick={() => onReview(documentEntry)} />
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-bold uppercase tracking-wide transition-colors ${
        danger
          ? "border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
          : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
      }`}
    >
      <Icon size={11} /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
