"use client";

import { Video, FileText, Upload, Link2, Paperclip, X } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import {
  LMS_RESOURCE_ACCEPT,
  formatFileSize,
  lmsMaxBytesForKind,
} from "@/lib/lms/constants";
import Field from "./Field";

const inputClassName = "w-full px-3 py-2 rounded-lg outline-none border text-xs";
const inputStyle = {
  background: "var(--surface-2)",
  borderColor: "var(--border-primary)",
  color: "var(--text-primary)",
};

/**
 * The resource form itself (kind, origin, fields, upload zone, actions).
 * Extracted verbatim from SectionResourcesEditor's `formContent`: it is a pure
 * view over the editor's form state and handlers, which the editor passes in.
 */
export default function ResourceForm({
  form,
  setForm,
  isPendingUpload,
  discardUpload,
  fileInputRef,
  handleFile,
  handleDrop,
  dragActive,
  setDragActive,
  uploading,
  uploadError,
  closeForm,
  submit,
  canSubmit,
  busy,
}) {
  const { t } = useI18n();

  return (
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
              setForm((prev) => ({ ...prev, kind, upload: drop ? null : prev.upload }));
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
            onClick={() => setForm((prev) => ({ ...prev, mode }))}
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
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
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
            onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
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
            onDragOver={(event) => {
              event.preventDefault();
              if (!uploading) setDragActive(true);
            }}
            onDragLeave={(event) => {
              // Moving onto a child element fires dragleave with the child as
              // target — ignore those, or the zone would flicker.
              if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
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
                      setForm((prev) => ({ ...prev, upload: null }));
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
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder={t("lms.sessionResources.fieldDescriptionPlaceholder")}
        />
      </Field>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_recommended}
          onChange={(event) => setForm((prev) => ({ ...prev, is_recommended: event.target.checked }))}
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
            onChange={(event) =>
              setForm((prev) => ({ ...prev, recommendation_note: event.target.value }))
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
}
