/**
 * Content translation — the pure half.
 *
 * The form screen translates its texts one string at a time, in the browser,
 * with nothing remembered between visits. That is affordable for one short
 * public form and unaffordable for a list of Venture work items, where the same
 * few dozen words are printed hundreds of times.
 *
 * This module owns the two decisions that make the shared process cheap, and
 * nothing else:
 *
 *   1. WHICH strings are content (a declared list of paths, never a blind walk:
 *      a person's name and a reference code must never be sent to a translator);
 *   2. WHICH strings are worth translating at all (a code such as `VNT-12` or a
 *      label such as `MVP` is not prose).
 *
 * Both are pure, so the collector, the detector and their tests need no React,
 * no network and no database.
 */

/**
 * Does this text look like prose rather than a code or an acronym?
 *
 * A string with no lowercase letter is a code, a reference or an acronym
 * (`VNT-12`, `MVP`, `OKR`, `2026-03-14`), and translating it can only mangle it.
 * Accented capitals count as prose, so `À VENDRE` is not silently skipped.
 */
export function isTranslatableText(text) {
  if (typeof text !== "string") return false;
  if (!text.trim()) return false;
  return /[a-zà-öø-ÿÀ-ÖØ-Þ]/u.test(text);
}

/**
 * A declared path, in a deliberately small notation:
 *
 *   `items[].title`             the `title` of every entry of `items`
 *   `items[].journey.name`      a nested object, for every entry
 *   `options.journeys[].name`   a list inside a nested object
 *
 * `[]` means "this segment is a list, walk every entry". Nothing else is
 * supported, because a general expression language would be a second thing to
 * learn for no screen that needs it.
 */
function parsePath(path) {
  return String(path)
    .split(".")
    .filter(Boolean)
    .map((segment) =>
      segment.endsWith("[]")
        ? { key: segment.slice(0, -2), each: true }
        : { key: segment, each: false },
    );
}

function walk(value, segments, visit) {
  if (value === null || value === undefined) return;
  if (segments.length === 0) {
    visit(value);
    return;
  }

  const [head, ...rest] = segments;
  const next = value[head.key];

  if (head.each) {
    if (!Array.isArray(next)) return;
    for (const entry of next) walk(entry, rest, visit);
    return;
  }

  walk(next, rest, visit);
}

/**
 * Every distinct translatable string the given paths reach, in the order met.
 *
 * The KEY of the translation memory is the text itself, so the exact original
 * string is kept (no trim) — a caller looking the mapping up with the stored
 * value must find it. Duplicates collapse here, which is the first saving: the
 * same milestone name printed on nine rows costs one translation, not nine.
 */
export function collectTexts(payload, paths) {
  const seen = new Set();
  const collected = [];

  for (const path of paths || []) {
    walk(payload, parsePath(path), (value) => {
      if (!isTranslatableText(value)) return;
      if (seen.has(value)) return;
      seen.add(value);
      collected.push(value);
    });
  }

  return collected;
}

// French is the only language in the product whose accents and function words
// are distinctive enough to score. A short pure-English corpus scores zero and
// stays English, which is the safe default: showing the original text is always
// acceptable, showing a wrong translation is not.
const FRENCH_ACCENTS = /[éèêëàâîïôûùçœ]/g;
const FRENCH_WORDS = /\b(le|la|les|des|du|une|un|et|pour|avec|dans|sur|par|aux|est|sont|cette|ces|qui|que)\b/gi;
const ENGLISH_WORDS = /\b(the|and|for|with|from|this|that|these|those|of|in|on|to|is|are|be|by)\b/gi;

/**
 * The language a corpus is written in, for a Venture whose language has not been
 * declared yet.
 *
 * This is a heuristic, and it is only trustworthy on a CORPUS — never on one
 * short title. `MVP` alone says nothing; forty titles and definitions in French
 * say a great deal. Step 4 of the plan replaces this with a language declared on
 * the Venture, and this becomes the fallback for old records only.
 */
export function detectContentLanguage(texts) {
  const corpus = (texts || []).filter((text) => typeof text === "string").join(" ");
  if (!corpus.trim()) return "en";

  const accents = (corpus.match(FRENCH_ACCENTS) || []).length;
  const frenchWords = (corpus.match(FRENCH_WORDS) || []).length;
  const englishWords = (corpus.match(ENGLISH_WORDS) || []).length;

  return accents * 1.5 + frenchWords - englishWords * 1.2 > 0 ? "fr" : "en";
}

/** Split a list into fixed-size batches, so one request stays bounded. */
export function splitIntoChunks(items, size) {
  const chunkSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}
