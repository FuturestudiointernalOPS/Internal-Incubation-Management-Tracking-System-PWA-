"use client";

import { Video, FileText, Star, ExternalLink, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * SESSION RESOURCES (learner, read-only)
 *
 * Renders the material a Program session depends on, as the learner sees it:
 * an explicit "Recommended for you" block (flagged resources + the note written
 * for them) followed by the rest of the session material. Purely presentational
 * — every link opens in a new tab and nothing is authored here.
 */
export default function SessionResourcesList({ resources = [] }) {
  const { t } = useI18n();
  if (!Array.isArray(resources) || resources.length === 0) return null;

  const recommended = resources.filter((r) => r.is_recommended);
  const others = resources.filter((r) => !r.is_recommended);

  return (
    <div className="space-y-3">
      {recommended.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold flex items-center gap-1.5 text-[var(--brand-orange)]">
            <Sparkles className="w-3.5 h-3.5" />
            {t("lms.sessionResources.recommendationsTitle")}
          </h4>
          {recommended.map((resource) => (
            <div
              key={resource.id}
              className="p-3 rounded-xl border"
              style={{
                borderColor: "rgb(255 102 0 / 0.25)",
                background: "rgb(255 102 0 / 0.06)",
              }}
            >
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold flex items-center gap-1.5 hover:underline"
                style={{ color: "var(--text-primary)" }}
              >
                {resource.kind === "video" ? (
                  <Video className="w-3.5 h-3.5 shrink-0 text-[var(--brand-orange)]" />
                ) : (
                  <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--brand-orange)]" />
                )}
                <span className="truncate">{resource.title}</span>
                <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
              </a>
              {resource.recommendation_note && (
                <p
                  className="text-[10px] mt-1 italic flex items-start gap-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Star className="w-3 h-3 mt-0.5 shrink-0 text-[var(--brand-orange)]" />
                  <span>{resource.recommendation_note}</span>
                </p>
              )}
              {resource.description && (
                <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                  {resource.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <h4
            className="text-xs font-semibold flex items-center gap-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            <FileText className="w-3.5 h-3.5" />
            {t("lms.sessionResources.learnerTitle")}
          </h4>
          {others.map((resource) => (
            <a
              key={resource.id}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 p-2.5 rounded-lg border hover:border-[var(--brand-orange)]/40 transition-all"
              style={{ borderColor: "var(--border-primary)" }}
            >
              {resource.kind === "video" ? (
                <Video className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--brand-blue)" }} />
              ) : (
                <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--brand-blue)" }} />
              )}
              <span className="min-w-0">
                <span
                  className="text-xs font-bold block truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {resource.title}
                </span>
                {resource.description && (
                  <span className="text-[10px] block" style={{ color: "var(--text-tertiary)" }}>
                    {resource.description}
                  </span>
                )}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
