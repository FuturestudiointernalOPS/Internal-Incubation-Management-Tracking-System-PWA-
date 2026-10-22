"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { collectTexts, detectContentLanguage, splitIntoChunks } from "@/lib/contentTranslation";

/**
 * The translated copy of a content payload, as a lookup function.
 *
 * ONE request for the whole screen, not one per field: the strings the declared
 * paths reach are deduplicated first (a milestone name printed nine times is one
 * string), then asked for in bounded batches. The server answers from its
 * translation memory and only reaches the provider for what it has never seen,
 * so the second visit costs no external call at all.
 *
 * The payload is never modified. `tv(original)` returns the translation when one
 * is in hand and the original otherwise — which is also what makes the first
 * paint immediate: the screen renders the source text, then swaps in place when
 * the answer lands, with no spinner and no blank.
 *
 * @param {object|null} payload  what the screen read
 * @param {string[]} paths       module-level constant, `items[].title`-style
 * @param {{sourceLang?: string, ventureId?: string}} [options] the declared
 *   language when one exists, and the Venture the content belongs to (the
 *   server checks the caller may read it — this endpoint is not a public proxy)
 * @returns {{tv: (text: string) => string, translating: boolean, sourceLang: string}}
 */
export function useContentTranslation(payload, paths, options = {}) {
  const { lang } = useI18n();

  // `paths` must be a module constant: the collector reads it, and a new array
  // on every render would start a translation on every render.
  const texts = useMemo(() => collectTexts(payload, paths), [payload, paths]);
  const detected = useMemo(() => detectContentLanguage(texts), [texts]);
  const sourceLang = options.sourceLang || detected;
  const ventureId = options.ventureId || null;

  const pair = `${sourceLang}>${lang}`;
  const needed = texts.length > 0 && sourceLang !== lang && Boolean(ventureId);

  // The answer is keyed on the language pair it was made for, so a language
  // switch never shows the previous language's copy while the new one loads.
  const [answer, setAnswer] = useState({ pair: null, map: null });
  // How many batches are still on the wire. The note under the list says the
  // wording is settling, so it must not disappear when the FIRST batch lands.
  const [pending, setPending] = useState(0);

  // The last text set that was actually requested. The payload identity is what
  // changes when the work is refreshed, so a new payload asks for its new texts —
  // and the answers already held are kept, so only the edited rows wait.
  const requested = useRef({ texts: null, pair: null, ventureId: null });

  useEffect(() => {
    if (!needed) return undefined;
    if (
      requested.current.pair === pair &&
      requested.current.texts === texts &&
      requested.current.ventureId === ventureId
    ) {
      return undefined;
    }

    requested.current = { texts, pair, ventureId };
    let cancelled = false;
    const batches = splitIntoChunks(texts, 100);
    let remaining = batches.length;
    setPending(remaining);

    // Each batch lands on its own. A long list therefore fills in progressively
    // instead of waiting for its slowest batch, and the rows already answered
    // never fall back to the source text.
    for (const batch of batches) {
      fetch("/api/translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: batch, sourceLang, targetLang: lang, ventureId }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payloadAnswer) => payloadAnswer?.translations || {})
        .catch(() => ({}))
        .then((received) => {
          if (cancelled || !Object.keys(received).length) return;
          setAnswer((previous) => ({
            pair,
            map: previous.pair === pair ? { ...previous.map, ...received } : received,
          }));
        })
        .finally(() => {
          remaining -= 1;
          if (!cancelled) setPending(remaining);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [needed, pair, texts, sourceLang, lang, ventureId]);

  const ready = answer.pair === pair ? answer.map : null;

  const tv = useCallback(
    (text) => {
      if (typeof text !== "string" || !text || !ready) return text;
      return ready[text] || text;
    },
    [ready],
  );

  return { tv, translating: needed && (pending > 0 || !ready), sourceLang };
}
