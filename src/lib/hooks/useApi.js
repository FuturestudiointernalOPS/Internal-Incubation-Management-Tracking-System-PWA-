"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useApi — Generic data-fetching hook
 *
 * Centralizes loading/error/data state, prevents race conditions,
 * supports stale-while-revalidate, and deduplicates the try/catch/finally
 * boilerplate found across 12+ pages.
 *
 * @param {string} url        - API endpoint to fetch
 * @param {object} [options]
 * @param {boolean} [options.immediate=true] - Fetch on mount
 * @param {any} [options.defaultValue=null]  - Default data value
 * @param {Array} [options.deps=[]]          - Re-fetch when these change
 * @param {Function} [options.transform]     - Transform raw response data
 * @param {number} [options.refetchInterval] - Polling interval in ms
 *
 * @returns {{ data, loading, error, status, refresh, setData }}
 *
 * `status` is the HTTP status of the last COMPLETED response for the CURRENT
 * address, and it is what lets a screen tell the three failures apart:
 *
 *   401                  the session expired
 *   other >= 400         the server refused
 *   null, with `error`   the request never got an answer
 *
 * It is null before the first answer and after a request that threw. A screen
 * that changes its address reads null again rather than the previous address's
 * verdict (see the note where it is derived).
 *
 * @example
 *   const { data: tasks, loading, error, refresh } = useApi("/api/tasks", {
 *     defaultValue: [],
 *     transform: (d) => d.tasks || [],
 *     deps: [filterStatus],
 *   });
 */

// In-memory GET cache (30s TTL) with stale-while-revalidate: returning to a
// page renders instantly from cache while data refreshes in the background.
// `refresh()` always bypasses the cache to fetch fresh data.
const CACHE_TTL = 30_000;
const responseCache = new Map();

// cacheGet/cacheSet are exported so callers that fetch outside useApi (e.g. the
// dashboard shell badge fetchers) can reuse the same in-memory GET cache.
export function cacheGet(url) {
  const entry = responseCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    responseCache.delete(url);
    return null;
  }
  return entry.data;
}

export function cacheSet(url, data) {
  responseCache.set(url, { data, ts: Date.now() });
}

// ─── In-flight GET sharing ──────────────────────────────────────────────────
// The cache above only helps AFTER a response arrives. Several components (the
// shell's badge chain and the page body) ask for the same endpoint in the same
// instant, all miss the empty cache, and each issues its own request — the log
// showed the same read arriving three or four times per page load. Requests
// already on the wire are shared here, so the second caller waits for the first
// answer instead of duplicating it.
const inflightFetches = new Map();

/**
 * GET + parse, resolving the response WHOLE: the parsed body together with the
 * status the server sent it with. `fetchJsonShared` below is the body-only form,
 * which is what most callers want; this one exists for the reads that have to
 * act on the status.
 *
 * Both forms share the same in-flight entry, so a caller asking for the envelope
 * and a caller asking for the body still put one request between them.
 */
export function fetchJsonEnvelope(url) {
  const existing = inflightFetches.get(url);
  if (existing) return existing;
  const pending = fetch(url)
    .then(async (res) => ({
      body: await res.json(),
      status: res.status,
      ok: res.ok,
    }))
    .finally(() => {
      if (inflightFetches.get(url) === pending) inflightFetches.delete(url);
    });
  inflightFetches.set(url, pending);
  return pending;
}

/** GET + parse, sharing one request per URL with anyone asking at the same time. */
export function fetchJsonShared(url) {
  return fetchJsonEnvelope(url).then((envelope) => envelope.body);
}

// ─── Shared SWR helpers (reused by DashboardLayout + page loaders) ───

/**
 * Background GET + cache write. Resolves with the parsed body when the
 * response is a `success` payload (the app-wide API convention); otherwise it
 * resolves silently and leaves the cache untouched.
 */
export function revalidateJson(url, apply) {
  return fetchJsonShared(url)
    .then((data) => {
      if (data && data.success) {
        cacheSet(url, data);
        if (typeof apply === "function") apply(data);
      }
    })
    .catch(() => {});
}

/**
 * Cache-first GET (stale-while-revalidate). When a fresh (≤30s) payload
 * exists it is applied synchronously and the network revalidation runs in the
 * background, so shells and pages paint instantly on return visits.
 */
export function fetchSwrJson(url, apply) {
  const hit = cacheGet(url);
  if (hit !== null && hit.success) {
    if (typeof apply === "function") apply(hit);
    return revalidateJson(url, apply);
  }
  return revalidateJson(url, apply);
}

export function useApi(url, options = {}) {
  const {
    immediate = true,
    defaultValue = null,
    deps = [],
    transform,
    refetchInterval,
  } = options;

  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  // The status of the last completed response, kept WITH the address it answered.
  // A screen that moves to another address must not keep reading the previous
  // address's verdict, and comparing during render is how that is avoided: an
  // effect that reset it would be state written from an effect, which is the
  // pattern this hook exists to remove.
  const [lastResponse, setLastResponse] = useState(null);
  const status = lastResponse && lastResponse.url === url ? lastResponse.status : null;

  // Track latest request to prevent stale responses
  const fetchIdRef = useRef(0);
  const activeRef = useRef(true);

  const fetchData = useCallback(async (bypassCache = false) => {
    if (!url) {
      setLoading(false);
      setData(defaultValue);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setError(null);

    // Stale-while-revalidate: show cached data instantly, refresh in background.
    const cached = bypassCache ? null : cacheGet(url);
    if (cached !== null) {
      setData(transform ? transform(cached) : cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const { body: json, status: httpStatus } = await fetchJsonEnvelope(url);

      // Discard stale responses
      if (fetchId !== fetchIdRef.current || !activeRef.current) return;

      setLastResponse({ url, status: httpStatus });
      cacheSet(url, json);

      const result = transform ? transform(json) : json;
      setData(result);
    } catch (err) {
      if (fetchId !== fetchIdRef.current || !activeRef.current) return;
      // A request that threw never produced a response, so there is no status to
      // report: the screen reads this as "no answer", not as "the server said X".
      setLastResponse({ url, status: null });
      setError(err.message || "Failed to fetch data");
      console.error(`[useApi] Error fetching ${url}:`, err);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [url, transform, defaultValue]);

  // Fetch on mount / dependency change
  useEffect(() => {
    if (!immediate) return;
    fetchData();
  }, [fetchData, immediate, ...deps]);

  // Polling
  useEffect(() => {
    if (!refetchInterval || !immediate) return;
    const interval = setInterval(fetchData, refetchInterval);
    return () => clearInterval(interval);
  }, [fetchData, refetchInterval, immediate]);

  // Cleanup on unmount
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  return { data, loading, error, status, refresh: () => fetchData(true), setData };
}

/**
 * useApiMulti — Fetch multiple endpoints in parallel
 *
 * @param {Array<{key: string, url: string, transform?: Function}>} endpoints
 * @param {object} [options]
 * @param {boolean} [options.immediate=true]
 * @param {Array} [options.deps=[]]
 *
 * @returns {{ data: Record<string, any>, loading: boolean, error: string|null, refresh: Function }}
 */
export function useApiMulti(endpoints, options = {}) {
  const { immediate = true, deps = [] } = options;

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const fetchIdRef = useRef(0);

  const fetchAll = useCallback(async (bypassCache = false) => {
    if (!endpoints || endpoints.length === 0) {
      setLoading(false);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setError(null);

    // Render immediately when every endpoint is already cached.
    const allCached =
      !bypassCache &&
      endpoints.every(({ url }) => !url || cacheGet(url) !== null);
    if (allCached) setLoading(false);
    else setLoading(true);

    try {
      const results = await Promise.all(
        endpoints.map(async ({ key, url, transform }) => {
          if (!url) return { key, value: null };
          const cached = bypassCache ? null : cacheGet(url);
          if (cached !== null) {
            return { key, value: transform ? transform(cached) : cached };
          }
          const json = await fetchJsonShared(url);
          cacheSet(url, json);
          const value = transform ? transform(json) : json;
          return { key, value };
        }),
      );

      if (fetchId !== fetchIdRef.current) return;

      const merged = {};
      results.forEach(({ key, value }) => {
        merged[key] = value;
      });
      setData(merged);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setError(err.message || "Failed to fetch");
      console.error("[useApiMulti] Error:", err);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [endpoints]);

  useEffect(() => {
    if (!immediate) return;
    fetchAll();
  }, [fetchAll, immediate, ...deps]);

  return { data, loading, error, refresh: () => fetchAll(true), setData };
}
