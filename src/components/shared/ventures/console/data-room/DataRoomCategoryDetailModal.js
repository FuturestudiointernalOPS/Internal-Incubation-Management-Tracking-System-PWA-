"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Upload,
  Plus,
  History,
  Pencil,
  Trash2,
  CalendarPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Share2,
} from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppBadge from "@/components/ui/AppBadge";
import AppButton from "@/components/ui/AppButton";
import { dataRoomCategory, isLegacyDocumentCategory } from "@/lib/dataRoom";
import { documentTitle, formatBytes, formatDate } from "./dataRoomUi";

const STATUS_VARIANT = {
  verified: "success",
  under_review: "warning",
  uploaded: "warning",
  rejected: "danger",
  expired: "default",
};

export default function DataRoomCategoryDetailModal({
  isOpen,
  categoryCode,
  requirement,
  documents = [],
  canManage = false,
  canReview = false,
  isInvestor = false,
  onClose,
  onOpenDoc,
  onUploadNew,
  onVersions,
  onReplace,
  onEdit,
  onReview,
  onSession,
  onAccess,
  onDelete,
  t,
}) {
  const [selectedDocId, setSelectedDocId] = useState(null);

  const categoryInfo = useMemo(() => {
    return categoryCode ? dataRoomCategory(categoryCode) : null;
  }, [categoryCode]);

  const categoryDocs = useMemo(() => {
    if (!categoryCode) return [];
    return documents.filter((d) => d.category === categoryCode);
  }, [documents, categoryCode]);

  const activeDoc = useMemo(() => {
    if (!categoryDocs.length) return null;
    return categoryDocs.find((d) => d.id === selectedDocId) || categoryDocs[0];
  }, [categoryDocs, selectedDocId]);

  if (!isOpen || !categoryCode) return null;

  const categoryTitle = categoryInfo ? t(categoryInfo.labelKey) : categoryCode;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={categoryTitle}
      size="xl"
    >
      <div className="space-y-6">
        {/* Category Header Meta */}
        <div
          className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                {t("dataRoom.fields.category")}:
              </span>
              <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>
                {categoryTitle}
              </span>
              {requirement && (
                <AppBadge variant={requirement.level === "required" ? "brand" : "default"}>
                  {t(`dataRoom.level.${requirement.level}`)}
                </AppBadge>
              )}
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {t("dataRoom.fileCount", { count: categoryDocs.length })}
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => onUploadNew?.(categoryCode)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--brand-orange)] text-black text-xs font-extrabold hover:opacity-90 transition-all shrink-0"
            >
              <Plus size={14} />
              <span>{t("dataRoom.upload")}</span>
            </button>
          )}
        </div>

        {/* Category Documents List */}
        {categoryDocs.length === 0 ? (
          <div
            className="py-12 px-6 rounded-2xl border text-center space-y-3"
            style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
          >
            <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center bg-[var(--surface-2)] text-[var(--text-secondary)]">
              <FileText size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {t("dataRoom.noDocuments")}
              </h4>
              <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
                {canManage
                  ? t("dataRoom.emptyCategory")
                  : t("dataRoom.emptyRoomAwaitingUpload")}
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => onUploadNew?.(categoryCode)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-xs font-extrabold"
              >
                <Upload size={14} />
                <span>{t("dataRoom.upload")}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <h4
              className="text-xs font-black uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("dataRoom.standard.documents")} ({categoryDocs.length})
            </h4>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {categoryDocs.map((doc) => {
                const status = doc.status || "uploaded";
                const isSelected = activeDoc?.id === doc.id;
                const isLegacy = isLegacyDocumentCategory(doc.category);
                const hasHref = Boolean(doc.file_url_signed);

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{
                      background: isSelected ? "var(--surface-3)" : "var(--surface-1)",
                      borderColor: isSelected ? "var(--brand-orange)" : "var(--border-primary)",
                    }}
                  >
                    <div
                      className="min-w-0 flex-1 cursor-pointer space-y-1"
                      onClick={() => onOpenDoc?.(doc, "preview")}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                          {documentTitle(doc)}
                        </span>
                        <AppBadge variant={STATUS_VARIANT[status] || "default"} dot>
                          {t(`dataRoom.status.${status}`)}
                        </AppBadge>
                        {isLegacy && (
                          <span className="rounded border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-amber-400">
                            {t("dataRoom.legacy.badge")}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        <span>v{doc.current_version || 1}</span>
                        <span>•</span>
                        <span>{formatBytes(doc.file_size) || "—"}</span>
                        <span>•</span>
                        <span>{formatDate(doc.created_at) || "—"}</span>
                        {doc.description && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{doc.description}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {hasHref && (
                        <button
                          type="button"
                          onClick={() => onOpenDoc?.(doc, "preview")}
                          className="px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-all"
                          style={{
                            background: "var(--surface-2)",
                            borderColor: "var(--border-primary)",
                            color: "var(--text-primary)",
                          }}
                        >
                          <ExternalLink size={13} />
                          <span>{t("dataRoom.view")}</span>
                        </button>
                      )}

                      {hasHref && (
                        <button
                          type="button"
                          onClick={() => onOpenDoc?.(doc, "download")}
                          className="p-1.5 rounded-lg border text-xs transition-all"
                          style={{
                            background: "var(--surface-2)",
                            borderColor: "var(--border-primary)",
                            color: "var(--text-secondary)",
                          }}
                          title={t("dataRoom.download")}
                        >
                          <Download size={14} />
                        </button>
                      )}

                      {canReview && (status === "uploaded" || status === "under_review") && (
                        <button
                          type="button"
                          onClick={() => onReview?.(doc)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1"
                        >
                          <ShieldCheck size={13} />
                          <span>{t("dataRoom.review")}</span>
                        </button>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onVersions?.(doc)}
                          className="p-1.5 rounded-lg border text-xs transition-all"
                          style={{
                            background: "var(--surface-2)",
                            borderColor: "var(--border-primary)",
                            color: "var(--text-secondary)",
                          }}
                          title={t("dataRoom.versions")}
                        >
                          <History size={14} />
                        </button>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onReplace?.(doc)}
                          className="p-1.5 rounded-lg border text-xs transition-all"
                          style={{
                            background: "var(--surface-2)",
                            borderColor: "var(--border-primary)",
                            color: "var(--text-secondary)",
                          }}
                          title={t("dataRoom.replaceVersion")}
                        >
                          <Upload size={14} />
                        </button>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onDelete?.(doc)}
                          className="p-1.5 rounded-lg border text-xs text-rose-400 hover:bg-rose-500/10 transition-all"
                          style={{ borderColor: "var(--border-primary)" }}
                          title={t("dataRoom.delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <AppButton variant="secondary" onClick={onClose}>
            {t("common.close")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}
