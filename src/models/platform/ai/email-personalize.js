/**
 * EMAIL TEMPLATE PERSONALIZATION — STRUCTURE PRESERVATION LAYER
 *
 * Pure functions (no imports, no side effects) that guarantee the AI can
 * personalize the CONTENT of an email template without redesigning its
 * STRUCTURE.
 *
 * Rules enforced here:
 *  - The admin owns the structure; the AI owns the wording.
 *  - Numbered lists, bullet lists, headings, paragraphs, links (hrefs),
 *    bold/italic tags and line breaks are preserved byte-for-byte.
 *  - {{placeholders}} are never renamed, removed, or invented.
 *
 * These helpers are unit-tested in scripts/test-email-personalize.mjs.
 */

/**
 * Convert a template body into a well-formed HTML fragment with proper
 * paragraph structure and real formatting:
 *  - If the body already contains HTML tags, Markdown emphasis is converted
 *    ONLY inside text nodes — the tag structure, attributes and links are
 *    never touched.
 *  - Otherwise plain text becomes paragraphs (blank-line separated), single
 *    line breaks become <br>, Markdown bold and italic emphasis become real
 *    <strong>/<em>, and Markdown bullet lines become a real <ul>.
 * Recipients must never see raw Markdown symbols in the final email.
 */
export function normalizeToHtml(body) {
  const text = String(body || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  if (/<[a-zA-Z][^>]*>/.test(text)) {
    // Already HTML — convert Markdown emphasis inside text nodes only.
    return splitHtmlParts(text)
      .map((p) => (p.type === "text" ? markdownInlineToHtml(p.value) : p.value))
      .join("");
  }

  const escape = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Escape first so raw user HTML stays text; Markdown conversion then
  // inserts REAL tags after escaping, so they survive it.
  const withLists = markdownListsToHtml(escape(text));
  const withInline = markdownInlineToHtml(withLists);

  const paragraphs = withInline
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      if (p.startsWith("<ul>")) return p; // real list block — keep as-is
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

/**
 * Convert supported Markdown emphasis in a plain-text segment:
 *   **bold**  → <strong>bold</strong>
 *   *italic* → <em>italic</em>
 * An unmatched leading "* " (list bullet) never matches here because inline
 * emphasis requires a closing "*" on the same line.
 */
export function markdownInlineToHtml(text) {
  if (!text || typeof text !== "string") return text;
  return String(text)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

/**
 * Convert Markdown bullet lines (* item / - item / + item) into a real <ul>
 * block. Only lines whose bullet is followed by a space are treated as list
 * items — emphasis asterisks are never consumed here.
 */
export function markdownListsToHtml(text) {
  const lines = String(text || "").split("\n");
  const out = [];
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^\s*[*+-]\s+(.+)$/);
    if (m) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${m[1]}</li>`);
    } else {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(line);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

/** Extract lowercased placeholder names from text ({{name}} → "name"). */
export function placeholdersOf(text) {
  const set = new Set();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(text || "")) !== null) set.add(m[1].toLowerCase());
  return set;
}

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

/**
 * Structural fingerprint of an HTML fragment: the ordered sequence of tags,
 * ignoring all text content. <a> tags keep their href as part of the
 * structure so links can never be changed or dropped.
 */
export function tagSkeleton(html) {
  const tokens = [];
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(html || "")) !== null) {
    const name = m[1].toLowerCase();
    const attrs = m[2] || "";
    if (name === "a") {
      const href = (attrs.match(/href\s*=\s*["']([^"']*)["']/i) || [])[1] || "";
      tokens.push(`a:href=${href}`);
    } else if (name === "br") {
      tokens.push("br");
    } else {
      tokens.push(m[0].startsWith("</") ? `/${name}` : name);
    }
  }
  return tokens.join("\u0001");
}

/**
 * Split an HTML fragment into an ordered list of parts:
 * { type: "tag", value: "<p>" } or { type: "text", value: "Hello " }.
 * Text parts exclude the surrounding tags so markup can be rejoined verbatim.
 */
export function splitHtmlParts(html) {
  const parts = [];
  TAG_RE.lastIndex = 0;
  let last = 0;
  let m;
  while ((m = TAG_RE.exec(html || "")) !== null) {
    if (m.index > last) parts.push({ type: "text", value: html.slice(last, m.index) });
    parts.push({ type: "tag", value: m[0] });
    last = TAG_RE.lastIndex;
  }
  if (last < (html || "").length) parts.push({ type: "text", value: html.slice(last) });
  return parts;
}

/**
 * Deterministically rebuild HTML by splicing personalized text segments back
 * into the ORIGINAL tag sequence. Only non-whitespace text parts consume a
 * segment; whitespace-only parts (paragraph gaps, line breaks) stay as-is.
 * By construction the resulting skeleton always equals the original.
 */
export function splicePersonalizedSegments(parts, segments) {
  let segIdx = 0;
  return parts
    .map((p) => {
      if (p.type !== "text") return p.value;
      if (p.value.trim().length === 0) return p.value; // keep whitespace/newlines
      const candidate = segments[segIdx] !== undefined ? segments[segIdx] : p.value;
      segIdx++;
      return candidate;
    })
    .join("");
}

/** Count the personalized (non-whitespace) text segments in a part list. */
export function countTextSegments(parts) {
  return parts.filter((p) => p.type === "text" && p.value.trim().length > 0).length;
}

/**
 * If the AI dropped a {{placeholder}} that existed in the original segment,
 * restore it so variables can never silently disappear.
 */
export function ensureSegmentPlaceholders(original, candidate) {
  let out = candidate == null ? original : String(candidate);
  const re = /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g;
  let m;
  while ((m = re.exec(original || "")) !== null) {
    if (!out.includes(m[0])) out = out.trimEnd() + " " + m[0];
  }
  return out;
}

/**
 * Remove any {{placeholder}} that is not in the allowed set so the AI can
 * never introduce incompatible variables.
 */
export function stripUnknownPlaceholders(text, allowedNames) {
  const set = allowedNames instanceof Set ? allowedNames : new Set(allowedNames || []);
  return (text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, name) =>
    set.has(name.toLowerCase()) ? full : ""
  );
}

/**
 * Validate an AI-produced body against the original template:
 *  1. identical tag skeleton (structure, order, links preserved)
 *  2. every original {{placeholder}} still present
 *  3. no unknown {{placeholders}} introduced
 */
export function validateStructure(originalHtml, candidateHtml, allowedNames) {
  if (tagSkeleton(originalHtml) !== tagSkeleton(candidateHtml)) {
    return { ok: false, reason: "structure_changed" };
  }
  const required = placeholdersOf(originalHtml);
  const present = placeholdersOf(candidateHtml);
  for (const name of required) {
    if (!present.has(name)) return { ok: false, reason: `missing_placeholder:${name}` };
  }
  const allowed = allowedNames instanceof Set ? allowedNames : new Set(allowedNames || []);
  for (const name of present) {
    if (!allowed.has(name)) return { ok: false, reason: `unknown_placeholder:${name}` };
  }
  return { ok: true };
}

/** Validate a personalized subject (placeholders preserved, no unknowns, sane length). */
export function validateSubject(originalSubject, candidateSubject, allowedNames) {
  const candidate = (candidateSubject || "").trim();
  if (!candidate || candidate.length > 160) return { ok: false, reason: "invalid_length" };
  const required = placeholdersOf(originalSubject);
  const present = placeholdersOf(candidate);
  for (const name of required) {
    if (!present.has(name)) return { ok: false, reason: `missing_placeholder:${name}` };
  }
  const allowed = allowedNames instanceof Set ? allowedNames : new Set(allowedNames || []);
  for (const name of present) {
    if (!allowed.has(name)) return { ok: false, reason: `unknown_placeholder:${name}` };
  }
  return { ok: true };
}

/**
 * Subject contract: an empty draft subject stays empty (so the existing
 * default-subject fallback applies at send time); a provided subject may be
 * replaced by the validated personalized version.
 */
export function finalizeSubject(draftSubject, personalizedSubject) {
  return draftSubject ? personalizedSubject || draftSubject : "";
}
