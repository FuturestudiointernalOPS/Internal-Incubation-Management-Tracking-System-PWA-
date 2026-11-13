"use client";

import { BookOpen, ExternalLink, File, FileText, Link, Video } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** One programme resource: a link (or a disabled-looking tile when it has none). */
export default function ResourceCard({ resource }) {
  const { t } = useI18n();
  const typeIcons = {
    video: Video,
    document: FileText,
    pdf: File,
    link: Link,
    template: File,
    guide: BookOpen,
  };
  const Icon = typeIcons[resource.fileType?.toLowerCase()] || BookOpen;
  const hasValidUrl =
    resource.url && resource.url !== "[]" && resource.url !== "";
  const isExternalUrl = hasValidUrl && resource.url.startsWith("http");

  if (!hasValidUrl) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] opacity-60 cursor-default">
        <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
            {resource.title}
          </p>
          {resource.description && (
            <p className="text-sm text-[var(--text-secondary)] truncate">
              {resource.description}
            </p>
          )}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] shrink-0">
          {t("participant.noFile")}
        </span>
      </div>
    );
  }

  return (
    <a
      href={resource.url}
      target={isExternalUrl ? "_blank" : "_self"}
      rel={isExternalUrl ? "noopener noreferrer" : ""}
      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] hover:border-brand-orange/20 transition-all group"
    >
      <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
          {resource.title}
        </p>
        {resource.description && (
          <p className="text-sm text-[var(--text-secondary)] truncate">
            {resource.description}
          </p>
        )}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--brand-orange)] transition-all shrink-0" />
    </a>
  );
}
