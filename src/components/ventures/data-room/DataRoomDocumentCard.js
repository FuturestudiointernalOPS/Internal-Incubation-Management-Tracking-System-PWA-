"use client";

import { useState, useRef, useEffect } from "react";
import {
  Download,
  Eye,
  FileText,
  History,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Share2,
  Trash2,
  Upload,
  CalendarPlus,
} from "lucide-react";
import { dataRoomCategory, isLegacyDocumentCategory } from "@/lib/dataRoom";
import { formatBytes, formatDate, STATUS_ACCENT, STATUS_CLASS, documentTitle } from "./dataRoomUi";

/**
 * Institutional Data Room Document Row
 *
 * Click to preview, with high-signal metadata and a clean 3-dots actions menu
 * instead of 8 cluttered horizontal buttons.
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
  onSession,
  onAccess,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const status = documentEntry.status || "uploaded";
  const decided =
    (status === "verified" || status === "rejected") &&
    Number(documentEntry.reviewed_version || 0) === Number(documentEntry.current_version || 1);
  const category = dataRoomCategory(documentEntry.category);
  const isLegacy = isLegacyDocumentCategory(documentEntry.category);
  const href = documentEntry.file_url_signed;
  const title = documentTitle(documentEntry);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      className={`rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-4 transition-all hover:border-[var(--brand-orange)]/40 ${STATUS_ACCENT[status] || STATUS_ACCENT.uploaded} border-l-4`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Document Icon & Title Block */}
        <div
          className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer"
          onClick={() => onOpen(documentEntry, "preview")}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{
              background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
              color: "var(--brand-orange)",
            }}
          >
            <FileText size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] transition-colors break-words">
                {title}
              </h4>
              {isLegacy && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400">
                  {t("dataRoom.legacy.badge")}
                </span>
              )}
              <span className={`uppercase font-bold tracking-wider text-[10px] px-2 py-0.5 rounded-full ${STATUS_CLASS[status] || STATUS_CLASS.uploaded}`}>
                {t(`dataRoom.status.${status}`)}
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)] mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[var(--text-primary)]">
                {category ? t(category.labelKey) : documentEntry.category}
              </span>
              <span>·</span>
              <span>v{documentEntry.current_version || 1}</span>
              {documentEntry.file_size ? (
                <>
                  <span>·</span>
                  <span>{formatBytes(documentEntry.file_size)}</span>
                </>
              ) : null}
              {documentEntry.created_at ? (
                <>
                  <span>·</span>
                  <span>{formatDate(documentEntry.created_at)}</span>
                </>
              ) : null}
            </p>

            {documentEntry.description && (
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 line-clamp-2">
                {documentEntry.description}
              </p>
            )}

            {documentEntry.review_notes && (
              <p className="text-xs text-amber-400/90 mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <strong>{t("dataRoom.metadata.reviewNotes")}:</strong> {documentEntry.review_notes}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {href && (
            <button
              type="button"
              onClick={() => onOpen(documentEntry, "preview")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-surface-3 hover:bg-[var(--brand-orange)] hover:text-black transition-all flex items-center gap-1.5"
            >
              <Eye size={13} />
              <span className="hidden sm:inline">Preview</span>
            </button>
          )}

          {href && (
            <button
              type="button"
              onClick={() => onOpen(documentEntry, "download")}
              title={t("dataRoom.download")}
              className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-surface-3 transition-colors"
            >
              <Download size={14} />
            </button>
          )}

          {canReview && !decided && (
            <button
              type="button"
              onClick={() => onReview(documentEntry)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all flex items-center gap-1"
            >
              <ShieldCheck size={13} /> Review
            </button>
          )}

          {canReview && status === "rejected" && (
            <button
              type="button"
              onClick={() => onSession(documentEntry)}
              className="px-2 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-primary)] text-[var(--text-secondary)] flex items-center gap-1"
            >
              <CalendarPlus size={13} /> Session
            </button>
          )}

          {/* ── 3-Dots Dropdown Menu ── */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-surface-3 transition-colors"
              aria-label="More actions"
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-44 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-2xl p-1 z-30 text-xs font-medium space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onVersions(documentEntry);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-3 text-[var(--text-primary)]"
                >
                  <History size={13} /> {t("dataRoom.versions")}
                </button>

                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onReplace(documentEntry);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-3 text-[var(--text-primary)]"
                    >
                      <Upload size={13} /> {t("dataRoom.replaceVersion")}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onAccess(documentEntry);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-3 text-[var(--text-primary)]"
                    >
                      <Share2 size={13} /> Grant Specific User
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(documentEntry);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-3 text-[var(--text-primary)]"
                    >
                      <Pencil size={13} /> {t("dataRoom.editDetails")}
                    </button>

                    <div className="border-t border-[var(--border-primary)] my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(documentEntry);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400"
                    >
                      <Trash2 size={13} /> {t("dataRoom.delete")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
