"use client";

import React, { useState } from "react";
import {
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  History,
  Pencil,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import AppMenu from "@/components/ui/AppMenu";
import { useI18n } from "@/lib/i18n";
import { dataRoomCategory, isLegacyDocumentCategory } from "@/lib/dataRoom";
import { documentTitle, formatBytes, formatDate } from "./dataRoomUi";

/**
 * The Data Room's document list, as a table.
 *
 * One row per document: what it is, where it is filed, its verdict, its version,
 * its size and when it arrived — the facts a reader compares across documents,
 * which a card makes them scroll to compare. The row opens the preview; the
 * decisions this screen exists for (Review) stay one click away, everything else
 * lives in the row's menu.
 *
 * Description and review notes do not fit in a row, so a row that has either
 * carries a chevron that opens them underneath it — nothing the card showed is
 * dropped.
 */
const DOT_STYLE = {
  uploaded: "var(--stf-warn)",
  under_review: "var(--stf-warn)",
  verified: "var(--stf-done)",
  rejected: "var(--stf-crit)",
  expired: "var(--text-tertiary)",
};

export default function DataRoomDocumentTable({
  documents = [],
  canManage = false,
  canReview = false,
  onOpen,
  onVersions,
  onReplace,
  onEdit,
  onReview,
  onSession,
  onAccess,
  onDelete,
}) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState(null);

  const headings = [
    t("dataRoom.standard.document"),
    t("dataRoom.fields.category"),
    t("dataRoom.standard.status"),
    t("dataRoom.metadata.version"),
    t("dataRoom.metadata.fileSize"),
    t("dataRoom.metadata.uploadedAt"),
    "",
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--border-primary)]">
            {headings.map((heading, index) => (
              <th
                key={heading || index}
                className="py-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] last:pr-0 last:text-right"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((documentEntry) => {
            const status = documentEntry.status || "uploaded";
            const decided =
              (status === "verified" || status === "rejected") &&
              Number(documentEntry.reviewed_version || 0) ===
                Number(documentEntry.current_version || 1);
            const category = dataRoomCategory(documentEntry.category);
            const isLegacy = isLegacyDocumentCategory(documentEntry.category);
            const href = documentEntry.file_url_signed;
            const hasDetail = Boolean(documentEntry.description || documentEntry.review_notes);
            const open = expandedId === documentEntry.id;

            const actions = [
              href && {
                key: "preview",
                label: t("dataRoom.view"),
                icon: Eye,
                onSelect: () => onOpen?.(documentEntry, "preview"),
              },
              href && {
                key: "download",
                label: t("dataRoom.download"),
                icon: Download,
                onSelect: () => onOpen?.(documentEntry, "download"),
              },
              {
                key: "versions",
                label: t("dataRoom.versions"),
                icon: History,
                onSelect: () => onVersions?.(documentEntry),
              },
              canManage && {
                key: "replace",
                label: t("dataRoom.replaceVersion"),
                icon: Upload,
                onSelect: () => onReplace?.(documentEntry),
              },
              canManage && {
                key: "grant",
                label: t("dataRoom.grantUser"),
                icon: Share2,
                onSelect: () => onAccess?.(documentEntry),
              },
              canManage && {
                key: "edit",
                label: t("dataRoom.editDetails"),
                icon: Pencil,
                onSelect: () => onEdit?.(documentEntry),
              },
              canReview &&
                status === "rejected" && {
                  key: "session",
                  label: t("dataRoom.scheduleSession"),
                  icon: CalendarPlus,
                  onSelect: () => onSession?.(documentEntry),
                },
              canManage && { key: "sep", separator: true },
              canManage && {
                key: "delete",
                label: t("dataRoom.delete"),
                icon: Trash2,
                danger: true,
                onSelect: () => onDelete?.(documentEntry),
              },
            ].filter(Boolean);

            return (
              <React.Fragment key={documentEntry.id}>
                <tr
                  onClick={() => {
                    if (href) onOpen?.(documentEntry, "preview");
                  }}
                  className={`border-b border-[var(--border-primary)] transition-colors hover:bg-[var(--surface-2)] ${
                    href ? "cursor-pointer" : ""
                  }`}
                >
                  <td className="py-2.5 pr-4">
                    <div className="flex min-w-[240px] max-w-[440px] items-start gap-1.5">
                      {hasDetail ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedId(open ? null : documentEntry.id);
                          }}
                          aria-expanded={open}
                          aria-label={t(open ? "common.collapse" : "common.expand")}
                          className="mt-0.5 shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        >
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <span className="mt-0.5 w-3.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                            {documentTitle(documentEntry)}
                          </span>
                          {isLegacy && (
                            <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
                              {t("dataRoom.legacy.badge")}
                            </span>
                          )}
                        </div>
                        {documentEntry.description && !open && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-secondary)]">
                            {documentEntry.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-[12px] text-[var(--text-secondary)]">
                    {category ? t(category.labelKey) : documentEntry.category}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: DOT_STYLE[status] || DOT_STYLE.expired }}
                      />
                      <span className="text-[12px] text-[var(--text-secondary)]">
                        {t(`dataRoom.status.${status}`)}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-[12px] tabular-nums text-[var(--text-secondary)]">
                    v{documentEntry.current_version || 1}
                  </td>
                  <td className="py-2.5 pr-4 text-[12px] tabular-nums text-[var(--text-secondary)]">
                    {formatBytes(documentEntry.file_size) || "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-[12px] text-[var(--text-secondary)]">
                    {formatDate(documentEntry.created_at) || "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {canReview && !decided && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onReview?.(documentEntry);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500 hover:text-black"
                        >
                          <ShieldCheck size={12} /> {t("dataRoom.review")}
                        </button>
                      )}
                      <span onClick={(event) => event.stopPropagation()}>
                        <AppMenu items={actions} label={t("dataRoom.standard.actions")} />
                      </span>
                    </div>
                  </td>
                </tr>

                {open && hasDetail && (
                  <tr className="border-b border-[var(--border-primary)] bg-[var(--surface-2)]">
                    <td colSpan={7} className="px-4 py-3">
                      {documentEntry.description && (
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          {documentEntry.description}
                        </p>
                      )}
                      {documentEntry.review_notes && (
                        <p className="mt-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[12px] text-amber-400/90">
                          <strong>{t("dataRoom.metadata.reviewNotes")}:</strong>{" "}
                          {documentEntry.review_notes}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
