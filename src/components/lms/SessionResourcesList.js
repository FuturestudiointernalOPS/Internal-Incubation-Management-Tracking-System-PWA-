"use client";

import { Video, FileText, Star, ExternalLink, Sparkles, Paperclip } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { extractYouTubeVideoId } from "@/lib/lms/youtube";
import { formatFileSize } from "@/lib/lms/constants";
import EmbeddedVideo from "./EmbeddedVideo";
import ResourcePreview from "./ResourcePreview";

/**
 * SESSION RESOURCES (learner, read-only)
 *
 * Renders the material a Program session depends on, as the learner sees it:
 * an explicit "Recommended for you" block (flagged resources + the note written
 * for them) followed by the rest of the session material. Uploaded files are
 * labelled with their filename and size, and previewed inline when the format
 * allows it (see ResourcePreview).
 *
 * A resource that links to a YouTube video plays HERE, through the same
 * embedded box a lesson uses (see EmbeddedVideo): a video the learner is
 * supposed to watch inside ImpactOS must not become a copyable link just
 * because it was attached to a session rather than to a course. Any other link
 * keeps opening in a new tab — we cannot know whether a third-party page agrees
 * to be framed, and a broken frame is worse than a plain link.
 *
 * Uploaded files arrive with a SHORT-LIVED SIGNED link, minted on the server
 * (§13.1 of the LMS architecture doc): this surface never sees the permanent
 * address of an object. When storage refuses to sign one, the resource comes
 * back without a link and the card says so rather than showing a dead one.
 * Nothing is authored here.
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
            <ResourceRow key={resource.id} resource={resource} highlighted />
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
            <ResourceRow key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One piece of session material: link, optional recommendation, optional preview. */
function ResourceRow({ resource, highlighted = false }) {
  const { t } = useI18n();
  const accent = highlighted ? "var(--brand-orange)" : "var(--brand-blue)";
  // The video this resource points at, when we can play it in the page. Keyed on
  // the link itself: a YouTube video stays a video whatever the author labelled
  // it. Null for anything else, including uploaded files.
  const videoId =
    resource.source === "link" ? extractYouTubeVideoId(resource.url) : null;
  // A playable video is labelled as one even when it was filed as a document.
  const Icon =
    videoId || resource.kind === "video"
      ? Video
      : resource.source === "upload"
        ? Paperclip
        : FileText;

  return (
    <div
      className="p-3 rounded-xl border"
      style={
        highlighted
          ? { borderColor: "rgb(255 102 0 / 0.25)", background: "rgb(255 102 0 / 0.06)" }
          : { borderColor: "var(--border-primary)" }
      }
    >
      {videoId || !resource.url ? (
        // Nothing to open here: either the video is played by the box below, or
        // the file could not be signed — a link we cannot hand over is simply
        // not rendered.
        <span
          className="text-xs font-bold flex items-center gap-1.5"
          style={{ color: "var(--text-primary)" }}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
          <span className="truncate">{resource.title}</span>
        </span>
      ) : (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold flex items-center gap-1.5 hover:underline"
          style={{ color: "var(--text-primary)" }}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
          <span className="truncate">{resource.title}</span>
          <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
        </a>
      )}

      {highlighted && resource.recommendation_note && (
        <p
          className="text-[10px] mt-1 italic flex items-start gap-1"
          style={{ color: "var(--text-secondary)" }}
        >
          <Star className="w-3 h-3 mt-0.5 shrink-0 text-[var(--brand-orange)]" />
          <span>{resource.recommendation_note}</span>
        </p>
      )}

      <ResourceMeta resource={resource} />

      {resource.description && (
        <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
          {resource.description}
        </p>
      )}

      <ResourcePreview resource={resource} />

      {!resource.url && (
        <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
          {t("lms.sessionResources.fileUnavailable")}
        </p>
      )}

      {videoId && (
        <div className="mt-2">
          <EmbeddedVideo
            key={videoId}
            videoId={videoId}
            title={resource.title}
            playLabel={t("lms.player.playVideo")}
          />
        </div>
      )}
    </div>
  );
}

/** Second line of a resource: the uploaded filename and size, when relevant. */
function ResourceMeta({ resource }) {
  if (resource.source !== "upload") return null;
  const size = formatFileSize(resource.file_size);
  if (!resource.file_name && !size) return null;
  return (
    <span
      className="text-[10px] flex items-center gap-1 mt-0.5"
      style={{ color: "var(--text-tertiary)" }}
    >
      <Paperclip className="w-2.5 h-2.5 shrink-0" />
      {resource.file_name && <span className="truncate">{resource.file_name}</span>}
      {resource.file_name && size ? <span>·</span> : null}
      {size ? <span>{size}</span> : null}
    </span>
  );
}
