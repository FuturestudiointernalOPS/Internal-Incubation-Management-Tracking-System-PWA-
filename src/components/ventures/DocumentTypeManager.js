"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  FileText,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AppButton from "@/components/ui/AppButton";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import AppSelect from "@/components/ui/AppSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { notify } from "@/lib/notify";
import { documentTypeIcon, documentTypeName } from "./documentTypeMeta";

/**
 * DATA BANK — the documents ONE Venture is asked for.
 *
 * The list belongs to the Venture: a Super Admin defines it, and so does that
 * Venture's Lead Manager (the staff member carrying the `lead_manager`
 * responsibility on it). The server decides which of the two is asking, and
 * `can_manage` in the read is what tells this screen whether to offer the
 * editing controls — a viewer who may only see the Venture gets the list
 * read-only rather than a control that would be refused.
 */

// Module scope on purpose: the reading hook keys its internal work on this
// function, so an inline arrow would restart the read on every render.
const pickVentureDocumentTypes = (payload) =>
  payload?.success
    ? {
        can_manage: Boolean(payload.can_manage),
        document_types: payload.document_types || [],
      }
    : null;

const EMPTY_FORM = {
  label_en: "",
  label_fr: "",
  description: "",
  required: true,
  verification_method: "upload",
};

const METHOD_OPTIONS = [
  { value: "upload", labelKey: "venture.documentTypes.methodUpload" },
  { value: "external", labelKey: "venture.documentTypes.methodExternal" },
];

export default function DocumentTypeManager({ ventureId, backHref = "/admin/ventures" }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { confirm } = useDialogs();

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const listUrl = ventureId
    ? `/api/ventures/${ventureId}/document-types?include_inactive=true`
    : null;

  const {
    data,
    loading,
    error: readError,
    status,
    refresh,
  } = useApi(listUrl, { defaultValue: null, transform: pickVentureDocumentTypes });

  const documentTypes = data?.document_types || [];
  const canManage = data?.can_manage === true;

  // A refusal arrives as a payload (so the transform yields null) and a request
  // that never answered arrives as `error`; both read as "could not load".
  const loadError =
    readError ||
    (status && status >= 400) ||
    (!loading && ventureId && data === null)
      ? t("venture.documentTypes.errorLoadFailed")
      : null;

  // Server errors arrive either as a locale key or as a ready sentence.
  const messageFor = (payload, fallbackKey) => {
    const raw = typeof payload?.error === "string" ? payload.error.trim() : "";
    if (raw) {
      const translated = t(raw);
      if (translated !== raw) return translated;
      if (raw.includes(" ")) return raw;
    }
    return t(fallbackKey);
  };

  const createType = async (event) => {
    event.preventDefault();
    if (!form.label_en.trim() || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/document-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!payload.success) throw new Error(messageFor(payload, "venture.documentTypes.errorSaveFailed"));
      notify("success", t("venture.documentTypes.created"));
      setForm(EMPTY_FORM);
      await refresh();
    } catch (caught) {
      notify("error", caught.message || t("venture.documentTypes.errorSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const patchType = async (id, fields) => {
    const response = await fetch(`/api/ventures/${ventureId}/document-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const payload = await response.json().catch(() => ({}));
    if (!payload.success) throw new Error(messageFor(payload, "venture.documentTypes.errorSaveFailed"));
  };

  const runWrite = async (work, successKey) => {
    try {
      await work();
      if (successKey) notify("success", t(successKey));
      await refresh();
    } catch (caught) {
      notify("error", caught.message || t("venture.documentTypes.errorSaveFailed"));
    }
  };

  const toggleActive = async (documentType) => {
    setBusyId(documentType.id);
    await runWrite(
      () => patchType(documentType.id, { is_active: !documentType.is_active }),
      documentType.is_active ? "venture.documentTypes.turnedOff" : "venture.documentTypes.turnedOn",
    );
    setBusyId(null);
  };

  const removeType = async (documentType) => {
    const accepted = await confirm({
      message: t("venture.documentTypes.deleteConfirm", {
        name: documentTypeName(documentType, lang, t),
      }),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!accepted) return;

    setBusyId(documentType.id);
    await runWrite(async () => {
      const response = await fetch(
        `/api/ventures/${ventureId}/document-types/${documentType.id}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!payload.success) throw new Error(messageFor(payload, "venture.documentTypes.errorSaveFailed"));
    }, "venture.documentTypes.deleted");
    setBusyId(null);
  };

  const moveType = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= documentTypes.length) return;
    const here = documentTypes[index];
    const there = documentTypes[target];
    setBusyId(here.id);
    // Swap the two display orders, keeping each row's own value.
    await runWrite(async () => {
      await patchType(here.id, { sort_order: Number(there.sort_order) || 0 });
      await patchType(there.id, { sort_order: Number(here.sort_order) || 0 });
    });
    setBusyId(null);
  };

  const openEdit = (documentType) => {
    setEditing(documentType);
    setEditForm({
      label_en: documentType.label_en || "",
      label_fr: documentType.label_fr || "",
      description: documentType.description || "",
      required: documentType.required !== false,
      verification_method: documentType.verification_method || "upload",
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editForm.label_en.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await patchType(editing.id, editForm);
      notify("success", t("venture.documentTypes.updated"));
      setEditing(null);
      await refresh();
    } catch (caught) {
      notify("error", caught.message || t("venture.documentTypes.errorSaveFailed"));
    } finally {
      setSavingEdit(false);
    }
  };

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const setEditField = (key, value) => setEditForm((previous) => ({ ...previous, [key]: value }));

  const methodLabel = (method) =>
    t(method === "external" ? "venture.documentTypes.methodExternal" : "venture.documentTypes.methodUpload");

  /** The name / French name / required pair, shared by the add form and the edit modal. */
  const nameFields = (values, setValue) => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AppInput
          label={t("venture.documentTypes.nameEnLabel")}
          placeholder={t("venture.documentTypes.nameEnPlaceholder")}
          value={values.label_en}
          onChange={(event) => setValue("label_en", event.target.value)}
          required
        />
        <AppInput
          label={t("venture.documentTypes.nameFrLabel")}
          placeholder={t("venture.documentTypes.nameFrPlaceholder")}
          value={values.label_fr}
          onChange={(event) => setValue("label_fr", event.target.value)}
        />
      </div>
      <AppInput
        label={t("venture.documentTypes.descriptionLabel")}
        placeholder={t("venture.documentTypes.descriptionPlaceholder")}
        value={values.description}
        onChange={(event) => setValue("description", event.target.value)}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AppSelect
          label={t("venture.documentTypes.methodLabel")}
          value={values.verification_method}
          onChange={(event) => setValue("verification_method", event.target.value)}
          options={METHOD_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
        />
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider ml-1 text-[var(--text-secondary)]">
            {t("venture.documentTypes.requiredLabel")}
          </label>
          <div className="flex gap-2">
            {[
              { value: true, labelKey: "common.yes" },
              { value: false, labelKey: "common.no" },
            ].map((choice) => {
              const selected = values.required === choice.value;
              return (
                <button
                  key={String(choice.value)}
                  type="button"
                  onClick={() => setValue("required", choice.value)}
                  className={`px-4 py-3 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all ${
                    selected
                      ? "border-[var(--brand-orange)] bg-brand-orange/10 text-[var(--brand-orange)]"
                      : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t(choice.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push(backHref)}
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> {t("common.back")}
      </button>

      <AppCard padding="lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
                {t("venture.documentTypes.title")}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t("venture.documentTypes.subtitle")}
              </p>
              {ventureId && (
                <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-1">{ventureId}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-brand-orange/10 text-[var(--brand-orange)]">
              {t("venture.documentTypes.badgeVenture")}
            </span>
            <AppButton variant="secondary" size="sm" icon={RefreshCw} onClick={() => refresh()}>
              {t("common.refresh")}
            </AppButton>
          </div>
        </div>

        <p className="text-[10px] text-[var(--text-secondary)] mt-4">
          {t("venture.documentTypes.ventureHint")}
        </p>

        {!loading && data !== null && !canManage && (
          <p className="text-[10px] text-[var(--text-secondary)] mt-2 flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> {t("venture.documentTypes.readOnly")}
          </p>
        )}
      </AppCard>

      {loadError && (
        <AppCard>
          <p className="text-xs text-rose-500">{loadError}</p>
        </AppCard>
      )}

      {loading && data === null && !loadError && (
        <AppCard padding="lg">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </AppCard>
      )}

      {canManage && (
        <AppCard padding="lg">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)] mb-4">
            {t("venture.documentTypes.addTitle")}
          </h2>
          <form onSubmit={createType} className="space-y-4">
            {nameFields(form, setField)}
            <div className="flex justify-end">
              <AppButton type="submit" icon={saving ? undefined : Plus} loading={saving}>
                {t("venture.documentTypes.addAction")}
              </AppButton>
            </div>
          </form>
        </AppCard>
      )}

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

      <AppModal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={t("venture.documentTypes.editTitle")}
        size="md"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          {nameFields(editForm, setEditField)}
          <div className="flex justify-end gap-2">
            <AppButton variant="secondary" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </AppButton>
            <AppButton type="submit" icon={savingEdit ? undefined : Save} loading={savingEdit}>
              {t("common.save")}
            </AppButton>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
