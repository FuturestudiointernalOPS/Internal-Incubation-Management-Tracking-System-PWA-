"use client";

import { useRef, useState } from "react";
import { Plus, FileText } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import { useI18n } from "@/lib/i18n";
import { isAcceptedResourceFile, lmsMaxBytesForKind } from "@/models/lms/constants";
import ResourceForm from "./section-resources-editor/ResourceForm";
import ResourceRow from "./section-resources-editor/ResourceRow";

/**
 * SECTION RESOURCES EDITOR
 *
 * The resource form itself — list, add, edit, delete — with no persistence of
 * its own. It is controlled so the course editor can host it directly:
 *
 *   - the section panel (SectionResourcesPanel) persists every change
 *     immediately through /api/lms/section-resources.
 *
 * Files are uploaded to storage as soon as they are picked (that is the only way
 * to obtain a URL) — hence `discardUnsavedUploads()`, which the host calls when
 * it abandons buffered resources.
 *
 * The view is split into `section-resources-editor/`: `ResourceForm` (the form)
 * and `ResourceRow` (one row). This module keeps the state, the handlers and the
 * list/modal orchestration.
 *
 * Props:
 *   resources     — the current list
 *   onCreate(values)               — add a resource
 *   onUpdate(resource, values)     — change one
 *   onDelete(resource)             — remove one
 *   title, accent, badge, canEdit, busy, loading, inlineForm,
 *   courseId, sectionId
 */

const EMPTY_FORM = {
  id: null,
  kind: "document",
  mode: "link", // "link" | "file"
  title: "",
  url: "",
  description: "",
  is_recommended: false,
  recommendation_note: "",
  upload: null, // { url, storage_path, file_name, file_size, mime_type, kind }
};

/**
 * Delete the stored objects of resources that were never saved. Only entries
 * carrying a `localId` are touched, so a persisted file can never be removed by
 * mistake. Fire-and-forget by design: this runs as a form is abandoned.
 */
export function discardUnsavedUploads(resources = []) {
  for (const resource of resources || []) {
    if (!resource?.localId || !resource.storage_path) continue;
    fetch(
      `/api/lms/section-resources/upload?path=${encodeURIComponent(resource.storage_path)}`,
      { method: "DELETE" },
    ).catch(() => {});
  }
}

export default function SectionResourcesEditor({
  resources = [],
  onCreate,
  onUpdate,
  onDelete,
  title,
  accent = "var(--brand-blue)",
  badge = null,
  canEdit = false,
  busy = false,
  loading = false,
  inlineForm = false,
  courseId,
  sectionId,
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  // Storage path the edited resource already points to: tells a freshly uploaded
  // (still unsaved) object from the persisted one.
  const savedPathRef = useRef(null);

  const recommended = (resources || []).filter((resource) => resource.is_recommended);
  const isFile = form.mode === "file";
  const canSubmit =
    !!form.title.trim() && (isFile ? !!form.upload : !!form.url.trim());

  const openCreate = () => {
    savedPathRef.current = null;
    setForm(EMPTY_FORM);
    setUploadError(null);
    setShowForm(true);
  };

  const openEdit = (resource) => {
    savedPathRef.current = resource.storage_path || null;
    setForm({
      id: resource.id ?? null,
      localId: resource.localId ?? null,
      kind: resource.kind,
      mode: resource.source === "upload" ? "file" : "link",
      title: resource.title || "",
      url: resource.url || "",
      description: resource.description || "",
      is_recommended: !!resource.is_recommended,
      recommendation_note: resource.recommendation_note || "",
      upload:
        resource.source === "upload"
          ? {
              url: resource.url,
              storage_path: resource.storage_path,
              file_name: resource.file_name,
              file_size: resource.file_size,
              mime_type: resource.mime_type,
              kind: resource.kind,
            }
          : null,
    });
    setUploadError(null);
    setShowForm(true);
  };

  const discardUpload = async (upload) => {
    if (!upload?.storage_path) return;
    try {
      await fetch(
        `/api/lms/section-resources/upload?path=${encodeURIComponent(upload.storage_path)}`,
        { method: "DELETE" },
      );
    } catch {
      /* best-effort cleanup */
    }
  };

  /**
   * A form upload is "pending" while it is not the object the edited resource
   * already points to — only those may be deleted here (a persisted object is
   * cleaned up by the service when the row actually changes).
   */
  const isPendingUpload = (upload) =>
    !!upload?.storage_path && upload.storage_path !== savedPathRef.current;

  const closeForm = () => {
    if (isPendingUpload(form.upload)) discardUpload(form.upload);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setDragActive(false);
    savedPathRef.current = null;
  };

  /**
   * Validate + upload one file. Shared by the picker and the drop zone so both
   * paths behave identically (same limits, same cleanup, same defaults).
   */
  const uploadFile = async (file) => {
    if (!file || uploading) return;

    if (!isAcceptedResourceFile(file, form.kind)) {
      setUploadError(
        t(
          form.kind === "video"
            ? "lms.errors.invalidVideoFile"
            : "lms.errors.invalidDocumentFile",
        ),
      );
      return;
    }
    const maxBytes = lmsMaxBytesForKind(form.kind);
    if (file.size > maxBytes) {
      setUploadError(
        t("lms.errors.fileTooLarge", { maxMb: Math.round(maxBytes / (1024 * 1024)) }),
      );
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", form.kind);
      if (courseId) body.append("course_id", courseId);
      if (sectionId) body.append("section_id", sectionId);
      const res = await fetch("/api/lms/section-resources/upload", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || "lms.errors.fileUploadFailed");

      if (isPendingUpload(form.upload) && form.upload.storage_path !== data.storage_path) {
        discardUpload(form.upload);
      }
      setForm((prev) => ({
        ...prev,
        upload: {
          url: data.url,
          storage_path: data.storage_path,
          file_name: data.file_name,
          file_size: data.file_size,
          mime_type: data.mime_type,
          kind: data.kind,
        },
        // Saving a minute of typing: the filename is a decent default title.
        title: prev.title.trim() ? prev.title : String(data.file_name || "").replace(/\.[^.]+$/, ""),
      }));
    } catch (err) {
      setUploadError(t(err.message) || t("lms.errors.fileUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    await uploadFile(file);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragActive(false);
    await uploadFile(event.dataTransfer?.files?.[0]);
  };

  /** Hand the form values to the host (create or update) and close on success. */
  const submit = async () => {
    // Switching origin must clear the fields of the other one.
    const values = {
      kind: isFile ? form.upload?.kind || form.kind : form.kind,
      title: form.title,
      description: form.description,
      url: isFile ? form.upload?.url : form.url,
      source: isFile ? "upload" : "link",
      storage_path: isFile ? form.upload?.storage_path : null,
      file_name: isFile ? form.upload?.file_name : null,
      file_size: isFile ? form.upload?.file_size : null,
      mime_type: isFile ? form.upload?.mime_type : null,
      is_recommended: form.is_recommended,
      recommendation_note: form.is_recommended ? form.recommendation_note : null,
    };

    try {
      const edited = { id: form.id, localId: form.localId };
      if (form.id || form.localId) await onUpdate?.(edited, values);
      else await onCreate?.(values);
      setShowForm(false);
      setForm(EMPTY_FORM);
      savedPathRef.current = null;
    } catch {
      /* the host surfaced the error; the form stays open so nothing is lost */
    }
  };

  const formContent = (
    <ResourceForm
      form={form}
      setForm={setForm}
      isPendingUpload={isPendingUpload}
      discardUpload={discardUpload}
      fileInputRef={fileInputRef}
      handleFile={handleFile}
      handleDrop={handleDrop}
      dragActive={dragActive}
      setDragActive={setDragActive}
      uploading={uploading}
      uploadError={uploadError}
      closeForm={closeForm}
      submit={submit}
      canSubmit={canSubmit}
      busy={busy}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {badge}
          <span
            className="text-[10px] font-black uppercase tracking-[0.2em] truncate"
            style={{ color: accent }}
          >
            {title}
          </span>
          {recommended.length > 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
              {t("lms.sessionResources.recommendedCount", { n: recommended.length })}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="text-[9px] font-black uppercase hover:underline flex items-center gap-1 shrink-0"
            style={{ color: accent }}
          >
            <Plus className="w-3 h-3" /> {t("lms.sessionResources.add")}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-4 h-4 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (resources || []).length === 0 ? (
          <div className="py-5 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-2xl opacity-40">
            <FileText className="w-6 h-6 mb-1.5" />
            <p
              className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("lms.sessionResources.empty")}
            </p>
          </div>
        ) : (
          resources.map((resource) => (
            <ResourceRow
              key={resource.id ?? resource.localId ?? resource.title}
              resource={resource}
              canEdit={canEdit}
              onEdit={() => openEdit(resource)}
              onDelete={() => onDelete?.(resource)}
            />
          ))
        )}
      </div>

      {inlineForm ? (
        showForm && (
          <div
            className="p-4 rounded-xl border"
            style={{ borderColor: "var(--border-primary)", background: "var(--surface-1)" }}
          >
            {formContent}
          </div>
        )
      ) : (
        <AppModal
          isOpen={showForm}
          onClose={closeForm}
          title={
            form.id || form.localId
              ? t("lms.sessionResources.editTitle")
              : t("lms.sessionResources.addTitle")
          }
          size="md"
        >
          {formContent}
        </AppModal>
      )}
    </div>
  );
}
