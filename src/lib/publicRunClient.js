// ─── Client helpers for the public run screen (`src/app/s/[runId]/page.js`) ───
// Browser/script helpers, kept out of the page so the screen stays about state,
// reads and handlers. Behaviour is unchanged from where they used to live.

// ─── Translation helper via MyMemory (free, no API key needed) ───
async function translateText(text, sourceLang, targetLang) {
  if (!text || !text.trim()) return text;
  if (sourceLang === targetLang) return text;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const response = await fetch(url);
    const payload = await response.json();
    return payload?.responseData?.translatedText || text;
  } catch (_) { return text; }
}

export async function translateBatch(strings, sourceLang, targetLang) {
  const results = [];
  for (const str of strings) {
    results.push(await translateText(str, sourceLang, targetLang));
  }
  return results;
}

// ─── Kkiapay's PLAIN web SDK (not the React package) ─────────────────────────
// Loaded once per page, and the widget is opened with `key` + `partnerId`.
const KKIAPAY_SCRIPT_URL = "https://cdn.kkiapay.me/k.js";

export function loadKkiapayScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.openKkiapayWidget) return Promise.resolve(true);
  if (!window.__kkiapayCheckoutScript) {
    window.__kkiapayCheckoutScript = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = KKIAPAY_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve(Boolean(window.openKkiapayWidget));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return window.__kkiapayCheckoutScript;
}

/**
 * Ask the SERVER to re-verify a payment with the provider (fire-and-forget).
 *
 * The Kkiapay notification is the primary path, but it can be missed — and a
 * real payment must not stay stuck on "en cours" because of it. The payer's own
 * tab is a second, independent way to reach the truth, but the BROWSER never
 * decides: it only asks, and the server answers with the verified result.
 */
export function requestPaymentVerification(reference, email, transactionId = null) {
  if (!reference || !email) return;
  fetch("/api/public/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "verify",
      reference,
      email,
      ...(transactionId ? { transactionId } : {}),
    }),
  }).catch(() => {});
}

/** The form's own language, guessed from the accents in its content. */
export function detectFormLanguage(strings) {
  const allText = strings.filter(Boolean).join(" ").toLowerCase();
  const frenchChars = (allText.match(/[éèêëàâîïôûùçœ]/g) || []).length;
  return frenchChars > 2 ? "fr" : "en";
}
