"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { resourcePreviewKind } from "@/lib/lms/constants";

/**
 * INLINE RESOURCE PREVIEW (learner surface)
 *
 * Shows an uploaded image directly, and reveals a PDF or a video inside the
 * page on demand (a click, never automatically — a week can hold several files
 * and nothing should download behind the learner's back).
 *
 * Only files uploaded through ImpactOS are previewed
 * (`resourcePreviewKind`, src/lib/lms/constants.js): an external link may refuse
 * to be embedded, and a broken frame is worse than a plain link. Whatever the
 * case, the resource title stays a link to the file itself.
 */
export default function ResourcePreview({ resource }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const kind = resourcePreviewKind(resource);
  if (!kind) return null;

  const frameStyle = {
    borderColor: "var(--border-primary)",
    background: "var(--surface-2)",
  };

  if (kind === "image") {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 w-fit"
        title={t("lms.sessionResources.openFullImage")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resource.url}
          alt={resource.title || ""}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="max-h-40 w-auto max-w-full rounded-lg border object-contain"
          style={frameStyle}
        />
      </a>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
        style={{ color: "var(--brand-blue)" }}
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open
          ? t("lms.sessionResources.hidePreview")
          : t("lms.sessionResources.showPreview")}
      </button>

      {open &&
        (kind === "pdf" ? (
          <iframe
            src={resource.url}
            title={resource.title || t("lms.sessionResources.learnerTitle")}
            className="w-full h-72 sm:h-96 rounded-lg border mt-1.5"
            style={frameStyle}
          />
        ) : (
          <video
            controls
            preload="metadata"
            src={resource.url}
            className="w-full max-h-64 rounded-lg border mt-1.5 bg-black"
            style={{ borderColor: "var(--border-primary)" }}
          />
        ))}
    </div>
  );
}
