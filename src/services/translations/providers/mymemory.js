/**
 * The translation provider (SERVICE adapter).
 *
 * Kept behind this one function so the engine is a decision, not a dependency:
 * the memory in front of it means the provider is only ever asked for a text it
 * has never seen, and swapping it (a keyed API, a self-hosted engine) changes
 * this file and nothing else.
 *
 * A failure is answered with `null`, never with the original text: `null` means
 * "not translated, do not remember it", so the next attempt can still succeed.
 * Returning the original would poison the memory with a fake translation.
 */

const ENDPOINT = "https://api.mymemory.translated.net/get";
const TIMEOUT_MS = 8000;

export const MYMEMORY_PROVIDER = "mymemory";

// MyMemory answers HTML-escaped text, and French prose is full of apostrophes.
// Rendered as a React text node, `l&#39;equipe` would be printed literally.
function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * One text, in the target language — or `null` when the provider could not
 * answer. `MYMEMORY_EMAIL` raises the free quota when the workstation or the
 * deployment sets it; the provider works without it.
 */
export async function translateText(text, sourceLang, targetLang) {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`,
  });

  const email = process.env.MYMEMORY_EMAIL;
  if (email) params.set("de", email);

  try {
    const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const payload = await response.json();
    const status = payload?.responseStatus;
    if (status !== undefined && Number(status) !== 200) return null;

    const translated = payload?.responseData?.translatedText;
    if (typeof translated !== "string") return null;

    const clean = decodeEntities(translated).trim();
    if (!clean) return null;
    // The free endpoint answers its own quota and length warnings in the
    // translated text field; those are not translations.
    if (/^(MYMEMORY WARNING|QUERY LENGTH LIMIT)/i.test(clean)) return null;

    return clean;
  } catch {
    return null;
  }
}
