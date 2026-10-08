"use client";

import {
  ArrowDown,
  ArrowUp,
  FileText,
  Loader2,
  Pencil,
  Power,
  Trash2,
} from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";
import { documentTypeIcon, documentTypeName } from "../documentTypeMeta";

/**
 * The list of document types ONE Venture is asked for. Every value comes from
 * the parent (`DocumentTypeManager`), which owns the state, the data read and
 * the writes; this component only renders. The row actions are passed down as
 * callbacks, so the parent stays the single place that talks to the server.
 */
export default function DocumentTypeList({
  documentTypes,
  loading,
  loadError,
  canManage,
  busyId,
  lang,
  moveType,
  openEdit,
  toggleActive,
  removeType,
}) {
  const { t } = useI18n();

  const methodLabel = (method) =>
    t(method === "external" ? "venture.documentTypes.methodExternal" : "venture.documentTypes.methodUpload");

  return (
    <div className="space-y-3">
      {!loading && !loadError && documentTypes.length === 0 && (
        <AppCard>
          <AppEmptyState
            title={t("venture.documentTypes.emptyTitle")}
            description={t("venture.documentTypes.emptyDescription")}
            icon={FileText}
          />
        </AppCard>
      )}

      {documentTypes.map((documentType, index) => {
        const Icon = documentTypeIcon(documentType.code);
        const busy = busyId === documentType.id;
        const isUpload = documentType.verification_method !== "external";
        return (
          <AppCard key={documentType.id} className={documentType.is_active ? "" : "opacity-60"}>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-orange/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[var(--brand-orange)]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {documentTypeName(documentType, lang, t)}
                  </p>
                  {documentType.is_builtin && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)]">
                      {t("venture.documentTypes.builtIn")}
                    </span>
                  )}
                  {!documentType.is_active && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                      {t("venture.documentTypes.inactive")}
                    </span>
                  )}
                </div>
                {documentType.description && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{documentType.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[10px] font-mono text-[var(--text-secondary)]">{documentType.code}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)]">
                    {methodLabel(documentType.verification_method)}
                  </span>
                  {isUpload && (
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        documentType.required !== false
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-[var(--surface-3)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {t(documentType.required !== false ? "common.required" : "common.optional")}
                    </span>
                  )}
                  {/* Storage-only documents are listed in the Data bank but
                      leave the readiness percentage alone. */}
                  {documentType.is_readiness === false && (
                    <span
                      className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)]"
                      title={t("venture.documentTypes.readinessHint")}
                    >
                      {t("venture.documentTypes.readinessNoBadge")}
                    </span>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  {busy && <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-orange)]" />}
                  <button
                    type="button"
                    onClick={() => moveType(index, -1)}
                    disabled={index === 0 || busy}
                    title={t("venture.documentTypes.moveUp")}
                    className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveType(index, 1)}
                    disabled={index === documentTypes.length - 1 || busy}
                    title={t("venture.documentTypes.moveDown")}
                    className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(documentType)}
                    disabled={busy}
                    title={t("common.edit")}
                    className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] disabled:opacity-30"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(documentType)}
                    disabled={busy}
                    title={
                      documentType.is_active
                        ? t("venture.documentTypes.turnOff")
                        : t("venture.documentTypes.turnOn")
                    }
                    className={`p-2 rounded-lg hover:bg-[var(--surface-2)] disabled:opacity-30 ${
                      documentType.is_active ? "text-emerald-500" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                  {!documentType.is_builtin && (
                    <button
                      type="button"
                      onClick={() => removeType(documentType)}
                      disabled={busy}
                      title={t("common.delete")}
                      className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </AppCard>
        );
      })}
    </div>
  );
}
