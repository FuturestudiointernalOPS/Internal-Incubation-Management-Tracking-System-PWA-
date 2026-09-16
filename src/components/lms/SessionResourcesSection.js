"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import {
  LMS_RESOURCE_ACCEPT,
  formatFileSize,
  isAcceptedResourceFile,
  lmsMaxBytesForKind,
} from "@/lib/lms/constants";

/**
 * SESSION RESOURCES (Phase 8 — Program Manager experience)
 *
 * The material a Program session depends on: videos and documents, each with an
 * optional "recommended" flag and note. Rendered inside one session card of the
 * Program curriculum (Phase 3 — Resources), right above Phase 4 (Learning/LMS).
 *
 * A resource is EITHER an external link (`source: 'link'`) OR a file uploaded
 * through ImpactOS (`source: 'upload'`) — the file is uploaded first
 * (/api/lms/session-resources/upload), then saved with its storage metadata, so
 * removing a resource can also delete the stored object. Files can be picked or
 * dropped on the zone.
 *
 * Storage rows live in `lms_session_resources` — never opaque JSON — so the
 * participant surface and any reporting can read them without parsing.
 *
 * Authorization: mutations require `lms.assign` server-side; `canEdit` only
 * controls visibility.
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

// Inputs follow the shared surface/border variables (no hardcoded colours).
const inputClassName = "w-full px-3 py-2 rounded-lg outline-none border text-xs";
const inputStyle = {
  background: "var(--surface-2)",
  borderColor: "var(--border-primary)",
  color: "var(--text-primary)",
};

/**
 * Client-side pre-check mirrors the server rules (src/lib/lms/constants.js) so
 * the PM gets instant feedback — the server still enforces both limits.
 */
export default function SessionResourcesSection({
  programId,
  sessionId,
  weekNumber,
  canEdit = false,
}) {
  const { t } = useI18n();
  const [resources, setResources] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  // Storage path already saved on the row being edited — lets the form tell a
  // freshly uploaded (still unsaved) object from the persisted one.
  const savedPathRef = useRef(null);

  const fetchResources = useCallback(async () => {
    setResources(null);
    const params = new URLSearchParams({ program_id: programId });
    if (sessionId) params.set("session_id", sessionId);
    try {
      const res = await fetch(`/api/lms/session-resources?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.loadFailed");
      setResources(data.resources || []);
    } catch (e) {
      notify("error", e.message || "lms.errors.loadFailed");
      setResources([]);
    }
  }, [programId, sessionId]);

  useEffect(() => {
    if (programId) fetchResources();
  }, [programId, fetchResources]);

  const openCreate = () => {
    savedPathRef.current = null;
    setForm(EMPTY_FORM);
    setUploadError(null);
    setShowForm(true);
  };

  const openEdit = (resource) => {
    savedPathRef.current =
      resource.source === "upload" ? resource.storage_path || null : null;
    setForm({
      id: resource.id,
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

  /** Discard an uploaded-but-unsaved object so storage never keeps orphans. */
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
   * A form upload is "pending" while it is not the object the saved row points
   * to — only those may be deleted when the PM swaps or drops the file (the
   * persisted object is removed by the service when the row actually changes).
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
      body.append("program_id", programId);
      if (sessionId) body.append("session_id", sessionId);
      const res = await fetch("/api/lms/session-resources/upload", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || "lms.errors.fileUploadFailed");

      // Replacing a still-unsaved upload drops it; the previously SAVED object
      // is cleaned up by the service once the row is updated.
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

  const save = async () => {
    setSaving(true);
    try {
      const isEdit = !!form.id;
      const isFile = form.mode === "file";
      const upload = form.upload;
      const res = await fetch(
        isEdit
          ? `/api/lms/session-resources/${form.id}`
          : "/api/lms/session-resources",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            program_id: programId,
            session_id: sessionId || null,
            week_number: weekNumber ?? null,
            kind: isFile ? upload?.kind || form.kind : form.kind,
            title: form.title,
            description: form.description,
            // Switching modes must clear the fields of the other origin.
            url: isFile ? upload?.url : form.url,
            source: isFile ? "upload" : "link",
            storage_path: isFile ? upload?.storage_path : null,
            file_name: isFile ? upload?.file_name : null,
            file_size: isFile ? upload?.file_size : null,
            mime_type: isFile ? upload?.mime_type : null,
            is_recommended: form.is_recommended,
            recommendation_note: form.is_recommended
              ? form.recommendation_note
              : null,
          }),
        },
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify(
        "success",
        isEdit
          ? "lms.sessionResources.updated"
          : "lms.sessionResources.created",
      );
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchResources();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (resource) => {
    if (!window.confirm(t("lms.sessionResources.confirmDelete"))) return;
    try {
      const res = await fetch(`/api/lms/session-resources/${resource.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.sessionResources.deleted");
      fetchResources();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    }
  };

  const recommended = (resources || []).filter((r) => r.is_recommended);
  const isFile = form.mode === "file";
  const canSave =
    !!form.title.trim() && (isFile ? !!form.upload : !!form.url.trim());

  return (
    <div className="space-y-4">
      {/* PHASE 3: RESOURCES (THE SUPPORT) */}
      <div className="flex items-center justify-between pb-3 border-b border-blue-500/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-black text-blue-500 border border-blue-500/20 shadow-sm">
            3
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
            {t("lms.sessionResources.title")}
          </span>
          {recommended.length > 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
              {t("lms.sessionResources.recommendedCount", { n: recommended.length })}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="text-[9px] font-black text-blue-500 uppercase hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> {t("lms.sessionResources.add")}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {resources === null ? (
          <div className="flex justify-center py-6">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : resources.length === 0 ? (
          <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-2xl opacity-40">
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
            <div
              key={resource.id}
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
                    <p
                      className="text-[10px] mt-0.5 truncate"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {resource.file_name}
                    </p>
                  )}
                  {resource.description && (
                    <p
                      className="text-[10px] mt-1 line-clamp-2"
                      style={{ color: "var(--text-secondary)" }}
                    >
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
                    onClick={() => openEdit(resource)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: "var(--text-tertiary)" }}
                    title={t("lms.sessionResources.edit")}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => remove(resource)}
                    className="p-1.5 rounded-lg text-rose-500/40 hover:text-rose-500 transition-all"
                    title={t("lms.sessionResources.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AppModal
        isOpen={showForm}
        onClose={closeForm}
        title={
          form.id
            ? t("lms.sessionResources.editTitle")
            : t("lms.sessionResources.addTitle")
        }
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {["document", "video"].map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  const drop = form.upload && form.upload.kind !== kind;
                  // Accepted types differ per kind: an upload for the other kind
                  // would be inconsistent, so it is dropped (and cleaned up when
                  // it was never saved).
                  if (drop && isPendingUpload(form.upload)) discardUpload(form.upload);
                  setForm((f) => ({ ...f, kind, upload: drop ? null : f.upload }));
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest"
                style={{
                  borderColor:
                    form.kind === kind ? "var(--brand-blue)" : "var(--border-primary)",
                  background:
                    form.kind === kind ? "rgba(0,102,255,0.08)" : "transparent",
                  color:
                    form.kind === kind ? "var(--brand-blue)" : "var(--text-secondary)",
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
                  borderColor:
                    form.mode === mode ? "var(--brand-orange)" : "var(--border-primary)",
                  background: form.mode === mode ? "rgb(255 102 0 / 0.08)" : "transparent",
                  color:
                    form.mode === mode ? "var(--brand-orange)" : "var(--text-secondary)",
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
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={t("lms.sessionResources.fieldDescriptionPlaceholder")}
            />
          </Field>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_recommended}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_recommended: e.target.checked }))
              }
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
              loading={saving}
              disabled={!canSave || uploading}
              onClick={save}
            >
              {t("common.save")}
            </AppButton>
          </div>
        </div>
      </AppModal>
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
