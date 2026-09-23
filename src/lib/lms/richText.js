/**
 * RICH TEXT (LMS descriptions)
 *
 * Course / section / lesson / assessment descriptions are authored in a rich
 * text editor and stored as a small HTML fragment. This module is the SINGLE
 * translation layer between what is stored and what is safe to put on a page.
 *
 * It is deliberately DOM-free: the LMS surfaces are client components, but they
 * also render on the server on the first paint, so a sanitiser that needed a
 * browser document would break that first paint. Everything here is pure text
 * work, usable on both sides.
 *
 * The stored value is therefore NEVER trusted when it is read back:
 *   - `plainTextToHtml` turns a legacy plain-text description into paragraphs
 *     (blank line = new paragraph, single line break = line break), which is
 *     what makes a multi-line description survive a save;
 *   - `toEditorHtml` is what the editor opens with — an existing plain-text
 *     description is shaped into paragraphs, a stored fragment is used as is;
 *   - `sanitizeRichText` walks a stored fragment and keeps ONLY a known set of
 *     formatting tags, drops every attribute except a validated http(s) link,
 *     and removes script/style/embedding elements entirely.
 *
 * Nothing here rewrites the database: legacy plain-text rows stay plain text
 * until their author saves them again through the editor.
 */

/** Whole elements removed with their content (never rendered, never kept). */
const BLOCKED_ELEMENTS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
  "noscript",
  "form",
  "input",
  "button",
];

/** The only formatting the editor produces and the reader accepts. */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "span",
]);

const VOID_TAGS = new Set(["br", "hr"]);

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Does this string already hold formatting (as opposed to legacy plain text)? */
export function isRichTextHtml(value) {
  return /<\/?(p|br|hr|strong|b|em|i|u|s|strike|del|code|pre|blockquote|ul|ol|li|h[1-6]|a|span|div)[\s/>]/i.test(
    String(value ?? ""),
  );
}

/**
 * Legacy plain text → paragraphs. A blank line starts a new paragraph; a single
 * line break becomes a line break inside the same paragraph, so the shape the
 * author typed is the shape the reader sees.
 */
export function plainTextToHtml(value) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return "";
  return text
    .split(/\n{2,}/)
    .map((block) => block.replace(/^\n+|\n+$/g, ""))
    .filter((block) => block.trim() !== "")
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** What the editor opens with: stored fragment as is, plain text as paragraphs. */
export function toEditorHtml(value) {
  const rawHtml = String(value ?? "");
  if (!rawHtml.trim()) return "";
  return isRichTextHtml(rawHtml) ? rawHtml : plainTextToHtml(rawHtml);
}

/** The text without any formatting — used for emptiness and short previews. */
export function richTextToPlain(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|blockquote|pre|div)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n");
}

export function isRichTextEmpty(value) {
  return richTextToPlain(value).trim() === "";
}

/** Remove whole blocked elements and stray comments/doctypes. */
function stripBlockedElements(html) {
  let cleanedHtml = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<![^>]*>/g, "");
  for (const name of BLOCKED_ELEMENTS) {
    cleanedHtml = cleanedHtml.replace(
      new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?<\\/${name}\\s*>`, "gi"),
      "",
    );
    cleanedHtml = cleanedHtml.replace(new RegExp(`<\\/?${name}\\b[^>]*>`, "gi"), "");
  }
  return cleanedHtml;
}

/** The href of an `<a>`, kept only when it is an absolute http(s) link. */
function safeHref(tag) {
  const match = tag.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  const rawHref = String(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  if (!rawHref) return null;
  try {
    const parsedUrl = new URL(rawHref);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return rawHref;
}

/**
 * The only HTML that may reach a page. Everything unknown is dropped (the tag
 * disappears, its text stays), and a link is rebuilt from scratch so no
 * attribute other than a validated href can survive.
 */
export function sanitizeRichText(value) {
  const html = String(value ?? "");
  if (!html) return "";
  return stripBlockedElements(html).replace(
    /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g,
    (match, rawName) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return "";
      if (match.startsWith("</")) return VOID_TAGS.has(name) ? "" : `</${name}>`;
      if (name === "a") {
        const href = safeHref(match);
        return href
          ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`
          : "<a>";
      }
      return `<${name}>`;
    },
  );
}
