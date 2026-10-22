/**
 * Content translation (SERVICE layer).
 *
 * The process in one sentence: deduplicate, read the memory, translate only what
 * the memory has never seen, remember the answers.
 *
 * Why it matters: the Venture work screen prints the same few dozen words
 * hundreds of times. Asking the provider per rendered field would mean a
 * thousand round trips for one page and a dead free quota by lunchtime. Asking
 * per distinct text, once ever, makes the second visit free and the first one a
 * few dozen calls.
 *
 * The service never throws on a memory failure: a database problem degrades to
 * "translate this time and do not remember", never to a blank screen. A provider
 * failure leaves the text out of the memory, so a later attempt can still win.
 */

import { createHash } from "node:crypto";
import {
  ensureContentTranslationsTable,
  insertContentTranslations,
  selectContentTranslations,
} from "@/models/contentTranslations";
import { isTranslatableText } from "@/lib/contentTranslation";
import { MYMEMORY_PROVIDER, translateText } from "./providers/mymemory";

/** The interface's languages: the only pairs the product can display. */
export const TRANSLATION_LANGUAGES = ["en", "fr"];

/** One request's ceiling, so a caller cannot turn the endpoint into a batcher. */
export const MAX_TEXTS_PER_REQUEST = 200;

/** Longest single text sent anywhere; a definition of done is prose, not a file. */
export const MAX_TEXT_LENGTH = 2000;

/** How many provider calls are in flight at once. */
const PROVIDER_CONCURRENCY = 4;

export function isTranslationLanguage(code) {
  return TRANSLATION_LANGUAGES.includes(String(code));
}

function hashSource(text) {
  return createHash("md5").update(text, "utf8").digest("hex");
}

/**
 * The distinct, translatable texts of a request — exact strings, so the answer
 * can be looked up with the value that was sent.
 */
function normalize(texts) {
  const seen = new Set();
  const kept = [];

  for (const raw of texts || []) {
    if (typeof raw !== "string") continue;
    if (raw.trim().length === 0) continue;
    if (raw.length > MAX_TEXT_LENGTH) continue;
    if (!isTranslatableText(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    kept.push(raw);
  }

  return kept;
}

/** Run `worker` over `items` with at most `limit` in flight, preserving order. */
async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Provider calls currently on the wire, keyed by language pair and text.
 *
 * The read warm-up and the reader's own request can ask for the SAME text at
 * the same instant, from two different requests of the same process. Without
 * this, the second one pays for a translation the first is already buying.
 * Only the real provider is shared: an injected translator belongs to its
 * caller and must not receive another caller's promise.
 */
const inFlightTranslations = new Map();

function translateOnce(text, sourceLang, targetLang, translate) {
  if (translate !== translateText) return translate(text, sourceLang, targetLang);

  const key = `${sourceLang}>${targetLang}:${hashSource(text)}`;
  const existing = inFlightTranslations.get(key);
  if (existing) return existing;

  const pending = Promise.resolve(translate(text, sourceLang, targetLang)).finally(() => {
    if (inFlightTranslations.get(key) === pending) inFlightTranslations.delete(key);
  });

  inFlightTranslations.set(key, pending);
  return pending;
}

/**
 * Translate a batch of texts and report where each answer came from.
 *
 * @returns {Promise<{translations: Record<string,string>, fromMemory: number, translated: number, failed: number}>}
 */
export async function translateContent({
  texts,
  sourceLang,
  targetLang,
  translate = translateText,
  provider = MYMEMORY_PROVIDER,
}) {
  const result = { translations: {}, fromMemory: 0, translated: 0, failed: 0 };
  const unique = normalize(texts);

  if (!unique.length || sourceLang === targetLang) return result;

  const hashByText = new Map(unique.map((text) => [text, hashSource(text)]));

  // ── 1. What the memory already knows ───────────────────────────────────────
  let remembered = [];
  try {
    await ensureContentTranslationsTable();
    const stored = await selectContentTranslations({
      sourceLang,
      targetLang,
      hashes: [...hashByText.values()],
    });
    remembered = stored.rows || [];
  } catch (error) {
    // A memory outage costs money, not correctness: translate and move on.
    console.error("[content-translation] memory read failed:", error.message);
  }

  const known = new Set();
  for (const row of remembered) {
    result.translations[row.source_text] = row.translated_text;
    known.add(row.source_text);
    result.fromMemory += 1;
  }

  const missing = unique.filter((text) => !known.has(text));
  if (!missing.length) return result;

  // ── 2. Translate only what is left, a few at a time ────────────────────────
  const answers = await runPool(missing, PROVIDER_CONCURRENCY, async (text) => ({
    text,
    translated: await translateOnce(text, sourceLang, targetLang, translate),
  }));

  const rows = [];
  for (const { text, translated } of answers) {
    if (!translated) {
      result.failed += 1;
      continue;
    }
    result.translations[text] = translated;
    result.translated += 1;
    rows.push({
      sourceLang,
      targetLang,
      sourceHash: hashByText.get(text),
      sourceText: text,
      translatedText: translated,
      provider,
    });
  }

  // ── 3. Remember them, so this text is never asked again ────────────────────
  if (rows.length) {
    try {
      await insertContentTranslations(rows);
    } catch (error) {
      console.error("[content-translation] memory write failed:", error.message);
    }
  }

  return result;
}
