"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * DISPLAY CURRENCY — the reader's own unit, and the rate to reach it.
 *
 * Two independent things:
 *   • the PREFERENCE (stored on the account, so it follows the user);
 *   • the RATE for a given source currency (fetched from our own API, cached
 *     server-side per day).
 *
 * Nothing here writes a financial figure. A component multiplies for DISPLAY and
 * keeps the stored amount untouched.
 */
export function useDisplayCurrency() {
  const [displayCurrency, setDisplay] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/me/preferences")
      .then((response) => response.json())
      .then((payload) => {
        if (active && payload?.success) setDisplay(payload.displayCurrency || null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setDisplayCurrency = useCallback(async (code) => {
    const next = code || null;
    setDisplay(next);
    try {
      const response = await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayCurrency: next }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!payload?.success) setDisplay(null);
      return payload?.success === true;
    } catch {
      setDisplay(null);
      return false;
    }
  }, []);

  return { displayCurrency, setDisplayCurrency, loaded };
}

/**
 * The rate from one currency to the reader's display currency.
 *
 * Returns `{ rate, rateDate, source }`, or `null` when no conversion applies —
 * either the reader follows the venture's own unit, or the rate is unavailable.
 * A null rate must make the caller print the ORIGINAL amount.
 */
export function useFxRate(base, quote, date = null) {
  const [fx, setFx] = useState(null);

  const from = String(base || "").toUpperCase();
  const to = String(quote || "").toUpperCase();
  const needsConversion = Boolean(from && to && from !== to);

  useEffect(() => {
    if (!needsConversion) return undefined;
    let active = true;
    const params = new URLSearchParams({ base: from, quote: to });
    if (date) params.set("date", date);
    fetch(`/api/finance/fx?${params}`)
      .then((response) => response.json())
      .then((payload) => {
        if (active && payload?.success) setFx(payload.fx || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [needsConversion, from, to, date]);

  // A stale pair from a previous render must never be applied: the rate is only
  // returned when it belongs to the currencies being asked about right now.
  if (!needsConversion) return null;
  return fx && fx.base === from && fx.quote === to ? fx : null;
}
