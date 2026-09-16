import { BookOpen } from "lucide-react";

/**
 * Course thumbnail — renders the author-provided image wherever a course is
 * displayed (admin list/preview, learner cards, program learning rows), with a
 * neutral icon placeholder when no thumbnail has been set yet.
 *
 * Sizing/rounding come from the caller via `className` (e.g. "w-14 h-14
 * rounded-xl"); the image is forced to object-cover so a 16:9 upload never
 * distorts inside a square slot. No text here — all labels stay in t().
 */
export default function CourseThumb({
  src,
  alt = "",
  className = "",
  iconClassName = "w-6 h-6",
  icon: Icon = BookOpen,
  ...imgProps
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={`${className} flex items-center justify-center shrink-0`}
        style={{ background: "var(--surface-3)" }}
      >
        <Icon className={iconClassName} style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }
   
  // Author-provided thumbnails point at arbitrary hosts, so this one cannot be
  // routed through the image optimiser: there is no fixed domain to allow and
  // the caller's own referrer and loading attributes are load-bearing. Kept as a
  // plain image deliberately, the same call already made in the other course
  // and lesson screens.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`${className} shrink-0 object-cover`}
      loading="lazy"
      {...imgProps}
    />
  );
}
