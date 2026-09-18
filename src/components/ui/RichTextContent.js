import { isRichTextEmpty, isRichTextHtml, sanitizeRichText } from "@/lib/lms/richText";

/**
 * Renders an authored description.
 *
 * Two shapes are possible on the same field, and both must read correctly:
 *   - a LEGACY plain-text description — shown as typed, line breaks kept
 *     (`whitespace-pre-wrap`), because that is exactly the "format changed
 *     after saving" problem this component exists to fix;
 *   - a rich fragment produced by the editor — sanitised, then rendered.
 *
 * It has no hooks, so it works in server-rendered and client components alike.
 */
export default function RichTextContent({ value, className = "", style, fallback = null }) {
  const raw = String(value ?? "");
  if (isRichTextEmpty(raw)) return fallback;

  if (isRichTextHtml(raw)) {
    return (
      <div
        className={`rich-text ${className}`}
        style={style}
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(raw) }}
      />
    );
  }

  return (
    <p className={`whitespace-pre-wrap ${className}`} style={style}>
      {raw}
    </p>
  );
}
