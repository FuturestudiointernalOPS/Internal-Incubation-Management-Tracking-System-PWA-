"use client";

import { useRef, useState } from "react";
import { Upload, RefreshCw, X } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_EXT = /\.(png|jpe?g|webp)$/i;
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Course image uploader — replaces the old "paste a thumbnail URL" input.
 * Uploads to /api/lms/courses/thumbnail and stores the returned public URL in
 * the form's thumbnail_url via onChange(). DB model unchanged.
 *
 * Controlled component: value = current thumbnail_url ("" when unset).
 */
export default function CourseImageUpload({ value = "", onChange }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXT.test(file.name || "")) {
      setError(t("lms.fields.thumbnailInvalidType"));
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(t("lms.fields.thumbnailTooLarge"));
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/lms/courses/thumbnail", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success || !data.url) {
        setError(data.error ? t(data.error) || data.error : t("lms.fields.thumbnailUploadFailed"));
        return;
      }
      onChange(data.url);
    } catch (err) {
      console.error("[LMS] thumbnail upload error:", err);
      setError(t("lms.fields.thumbnailUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label
        className="text-[10px] font-bold uppercase tracking-wider ml-1"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("lms.fields.thumbnail")}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={uploading}
        onChange={handleFile}
      />

      {value ? (
        <div
          className="rounded-xl border overflow-hidden w-full max-w-sm"
          style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={t("lms.fields.thumbnail")}
            referrerPolicy="no-referrer"
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
        >
          {uploading ? (
            <>
              <span className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("lms.fields.thumbnailUploading")}
              </span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" style={{ color: "var(--brand-orange)" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {t("common.upload")}
              </span>
            </>
          )}
        </button>
      )}

      <div className="flex items-center gap-2">
        <AppButton
          variant="secondary"
          size="sm"
          icon={value ? RefreshCw : Upload}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {value ? t("lms.fields.thumbnailReplace") : t("common.upload")}
        </AppButton>
        {value && (
          <AppButton variant="ghost" size="sm" icon={X} onClick={() => onChange("")}>
            {t("lms.fields.thumbnailRemove")}
          </AppButton>
        )}
      </div>

      <p className="text-[10px] font-medium ml-1" style={{ color: "var(--text-tertiary)" }}>
        {t("lms.fields.thumbnailHint")}
      </p>

      {error && <p className="text-[10px] font-bold ml-1 text-rose-500">{error}</p>}
    </div>
  );
}
