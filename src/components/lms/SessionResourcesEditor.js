"use client";

import { useRef, useState } from "react";
import {
  Plus,
  Video,
  FileText,
  Trash2,
  Pencil,
  Star,
  ExternalLink,
  Sparkles,
  Upload,
  Link2,
  Paperclip,
  X,
} from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import {
  LMS_RESOURCE_ACCEPT,
  formatFileSize,
  isAcceptedResourceFile,
  lmsMaxBytesForKind,
} from "@/lib/lms/constants";

/**
 * SESSION RESOURCES EDITOR (Phase 8)
 *
 * The resource form itself — list, add, edit, delete — with no persistence of
 * its own. Two hosts use it, which is why it is controlled:
 *
 *   - the session card panel (SessionResourcesSection) persists every change
 *     immediately through /api/lms/session-resources;
 *   - the Program Manager's session form (creating a session) buffers the
 *     resources in component state and saves them once the session exists.
 *
 * Whatever the host, files are uploaded to storage as soon as they are picked
 * (that is the only way to obtain a URL) — hence `discardUnsavedUploads()`,
 * which hosts call when they abandon buffered resources.
 *
 * Props:
 *   resources     — the current list (server rows and/or buffered entries)
 *   onCreate(values)               — add a resource
 *   onUpdate(resource, values)     — change one
 *   onDelete(resource)             — remove one
 *   title, accent, badge, canEdit, busy, loading, inlineForm,
 *   programId, sessionId
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

const inputClassName = "w-full px-3 py-2 rounded-lg outline-none border text-xs";
const inputStyle = {
  background: "var(--surface-2)",
  borderColor: "var(--border-primary)",
  color: "var(--text-primary)",
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
      `/api/lms/session-resources/upload?path=${encodeURIComponent(resource.storage_path)}`,
      { method: "DELETE" },
    ).catch(() => {});
  }
}

export default function SessionResourcesEditor({
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
  programId,
  sessionId,
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

  const recommended = (resources || []).filter((r) => r.is_recommended);
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
        `/api/lms/session-resources/upload?path=${encodeURIComponent(upload.storage_path)}`,
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
      if (programId) body.append("program_id", programId);
      if (sessionId) body.append("session_id", sessionId);
      const res = await fetch("/api/lms/session-resources/upload", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || "lms.errors.fileUploadFailed");

      if (isPendingUpload(form.upload) && form.upload.storage_path !== data.storage_path) {
        discardUpload(form.upload);
      }
      setForm((f) => ({
        ...f,
        upload: {
          url: data.url,
          storage_path: data.storage_path,
          file_name: data.file_name,
          file_size: data.file_size,
          mime_type: data.mime_type,
          kind: data.kind,
        },
        // Saving a minute of typing: the filename is a decent default title.
        title: f.title.trim() ? f.title : String(data.file_name || "").replace(/\.[^.]+$/, ""),
      }));
    } catch (err) {
      setUploadError(t(err.message) || t("lms.errors.fileUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    await uploadFile(file);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    await uploadFile(e.dataTransfer?.files?.[0]);
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
    <div className="space-y-4">
      <div className="flex gap-2">
        {["document", "video"].map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              const drop = form.upload && form.upload.kind !== kind;
              // Accepted types differ per kind: an upload for the other kind
              // would be inconsistent, so it is dropped (and cleaned up when it
              // was never saved).
              if (drop && isPendingUpload(form.upload)) discardUpload(form.upload);
              setForm((f) => ({ ...f, kind, upload: drop ? null : f.upload }));
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest"
            style={{
              borderColor: form.kind === kind ? "var(--brand-blue)" : "var(--border-primary)",
              background: form.kind === kind ? "rgba(0,102,255,0.08)" : "transparent",
              color: form.kind === kind ? "var(--brand-blue)" : "var(--text-secondary)",
            }}
          >
            {kind === "video" ? (
              <Video className="w-3.5 h-3.5" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            {t(`lms.sessionResources.kind.${kind}`)}
          </button>
        ))}
      </div>

      {/* Origin: external link or uploaded file */}
      <div className="flex gap-2">
        {[
          { mode: "link", icon: Link2, key: "originLink" },
          { mode: "file", icon: Upload, key: "originFile" },
        ].map(({ mode, icon: Icon, key }) => (
          <button
            key={mode}
            type="button"
            onClick={() => setForm((f) => ({ ...f, mode }))}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all text-[9px] font-black uppercase tracking-widest"
            style={{
              borderColor: form.mode === mode ? "var(--brand-orange)" : "var(--border-primary)",
              background: form.mode === mode ? "rgb(255 102 0 / 0.08)" : "transparent",
              color: form.mode === mode ? "var(--brand-orange)" : "var(--text-secondary)",
            }}
          >
            <Icon className="w-3 h-3" />
            {t(`lms.sessionResources.${key}`)}
          </button>
        ))}
      </div>

      <Field label={t("lms.sessionResources.fieldTitle")}>
        <input
          className={inputClassName}
          style={inputStyle}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder={t("lms.sessionResources.fieldTitlePlaceholder")}
        />
      </Field>

      {form.mode === "link" ? (
        <Field label={t("lms.sessionResources.fieldUrl")}>
          <input
            className={inputClassName}
            style={inputStyle}
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder={t("lms.sessionResources.fieldUrlPlaceholder")}
          />
        </Field>
      ) : (
        <Field label={t("lms.sessionResources.fieldFile")}>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={LMS_RESOURCE_ACCEPT[form.kind]}
            disabled={uploading}
            onChange={handleFile}
          />

          {/* Drop zone: the whole area accepts a drop, in both states (an
              existing file can be replaced by dropping a new one). */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDragActive(true);
            }}
            onDragLeave={(e) => {
              // Moving onto a child element fires dragleave with the child as
              // target — ignore those, or the zone would flicker.
              if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false);
            }}
            onDrop={handleDrop}
          >
            {form.upload ? (
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-lg border"
                style={{
                  background: "var(--surface-2)",
                  borderColor: dragActive ? "var(--brand-orange)" : "var(--border-primary)",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="w-4 h-4 shrink-0 text-blue-500" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {form.upload.file_name}
                    </p>
                    {form.upload.file_size ? (
                      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                        {formatFileSize(form.upload.file_size)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <AppButton
                    variant="ghost"
                    size="sm"
                    icon={Upload}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t("lms.sessionResources.replaceFile")}
                  </AppButton>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPendingUpload(form.upload)) discardUpload(form.upload);
                      setForm((f) => ({ ...f, upload: null }));
                    }}
                    className="p-1.5 rounded-lg text-rose-500/50 hover:text-rose-500 transition-all"
                    title={t("common.remove")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-5 rounded-lg border border-dashed flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-60"
                style={{
                  background: dragActive ? "rgb(255 102 0 / 0.08)" : "var(--surface-2)",
                  borderColor: dragActive ? "var(--brand-orange)" : "var(--border-primary)",
                }}
              >
                {uploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("lms.sessionResources.uploading")}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" style={{ color: "var(--brand-orange)" }} />
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {dragActive
                        ? t("lms.sessionResources.dropHere")
                        : t("lms.sessionResources.chooseFile")}
                    </span>
                    <span className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                      {dragActive
                        ? t("lms.sessionResources.orBrowse")
                        : t("lms.sessionResources.fileHint", {
                            maxMb: Math.round(lmsMaxBytesForKind(form.kind) / (1024 * 1024)),
                          })}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          {uploadError && (
            <p className="text-[10px] font-bold mt-1 text-rose-500">{uploadError}</p>
          )}
        </Field>
      )}

      <Field label={t("lms.sessionResources.fieldDescription")}>
        <textarea
          className={inputClassName}
          style={inputStyle}
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t("lms.sessionResources.fieldDescriptionPlaceholder")}
        />
      </Field>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_recommended}
          onChange={(e) => setForm((f) => ({ ...f, is_recommended: e.target.checked }))}
          className="mt-0.5"
        />
        <span>
          <span
            className="text-[10px] font-black uppercase tracking-widest block"
            style={{ color: "var(--text-primary)" }}
          >
            {t("lms.sessionResources.markRecommended")}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.sessionResources.markRecommendedHint")}
          </span>
        </span>
      </label>

      {form.is_recommended && (
        <Field label={t("lms.sessionResources.fieldNote")}>
          <textarea
            className={inputClassName}
            style={inputStyle}
            rows={2}
            value={form.recommendation_note}
            onChange={(e) =>
              setForm((f) => ({ ...f, recommendation_note: e.target.value }))
            }
            placeholder={t("lms.sessionResources.fieldNotePlaceholder")}
          />
        </Field>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <AppButton variant="secondary" onClick={closeForm}>
          {t("common.cancel")}
        </AppButton>
        <AppButton
          variant="primary"
          loading={busy}
          disabled={!canSubmit || uploading}
          onClick={submit}
        >
          {form.id || form.localId
            ? t("lms.sessionResources.saveChanges")
            : t("lms.sessionResources.addResource")}
        </AppButton>
      </div>
    </div>
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

/** One resource: link, optional recommendation, optional pending marker. */
function ResourceRow({ resource, canEdit, onEdit, onDelete }) {
  const { t } = useI18n();
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
            onClick={() => {
              if (window.confirm(t("lms.sessionResources.confirmDelete"))) onDelete();
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

function Field({ label, children }) {
  return (
    <div>
      <label
        className="block text-[9px] font-black uppercase tracking-widest mb-1.5"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
