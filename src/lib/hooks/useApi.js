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
 * @param {Array} [options.deps=[]]          - Re-fetch when these change.
 *                                             The LENGTH of this array must not
 *                                             vary between renders: it is spread
 *                                             into the read's effect dependency
 *                                             list, and React refuses a list whose
 *                                             size changed since the last render.
 *                                             The values may be anything React
 *                                             compares by identity (a primitive,
 *                                             or a memoised object).
 * @param {Function} [options.transform]     - Transform raw response data
 * @param {object}   [options.fetchOptions]  - Passed to the request itself
 *                                             (`{ cache: "no-store" }` for an
 *                                             answer the browser must not keep)
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
 * `transform` shapes the answer, so its identity is deliberately NOT a dependency
 * of the read: written inline (as below) it is a new function on every render,
 * and an identity that keyed the read would put the request back on the wire
 * every render. Building it once at module scope is still the clearer habit.
 *
 * @example
 *   const pickTasks = (d) => d.tasks || [];   // module scope, built once
 *
 *   const { data: tasks, loading, error, refresh } = useApi("/api/tasks", {
 *     defaultValue: [],
 *     transform: pickTasks,
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
 *
 * `fetchOptions` is passed to the request itself. A caller that passes any opts out
 * of the sharing, in both directions: it does not receive another caller's request
 * - which may have been made with different options - and it publishes nothing for
 * others to receive. The one caller that needs this wants the browser to keep no
 * copy of a private answer, and a shared entry would defeat that.
 */
export function fetchJsonEnvelope(url, fetchOptions) {
  const existing = fetchOptions ? null : inflightFetches.get(url);
  if (existing) return existing;
  const pending = fetch(url, fetchOptions)
    .then(async (res) => ({
      body: await res.json(),
      status: res.status,
      ok: res.ok,
    }))
    .finally(() => {
      if (inflightFetches.get(url) === pending) inflightFetches.delete(url);
    });
  if (!fetchOptions) inflightFetches.set(url, pending);
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
  const cachedPayload = cacheGet(url);
  if (cachedPayload !== null && cachedPayload.success) {
    if (typeof apply === "function") apply(cachedPayload);
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
    fetchOptions,
    refetchInterval,
  } = options;

  const [readData, setData] = useState(defaultValue);
  const [readLoading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  // The status of the last completed response, kept WITH the address it answered.
  // A screen that moves to another address must not keep reading the previous
  // address's verdict, and comparing during render is how that is avoided: an
  // effect that reset it would be state written from an effect, which is the
  // pattern this hook exists to remove.
  const [lastResponse, setLastResponse] = useState(null);

  // What the caller sees is decided during render, and gated on the address:
  // with no address there is nothing to read, so there is nothing loading, no
  // failure to report and nothing to show but the caller's default.
  //
  // Deciding it here rather than inside the read is the important part. The
  // default is what the caller wants to see when a read has nothing to offer - a
  // shape, not an event - and callers write `defaultValue: []`, which is a new
  // array on every render. While it was a dependency of the read, every render
  // started another read; the measurement that found this counted twenty-six
  // requests for one screen.
  const data = url ? readData : defaultValue;
  const loading = url ? readLoading : false;
  const visibleError = url ? error : null;
  const status =
    url && lastResponse && lastResponse.url === url ? lastResponse.status : null;

  // Track latest request to prevent stale responses
  const fetchIdRef = useRef(0);
  const activeRef = useRef(true);

  // The caller's `deps` are spread into the read's effect below, so the SIZE of
  // that list is part of the hook's contract: React refuses a list whose size
  // changed between renders, with a message that does not name the screen. In
  // development the same check is mirrored here, where the error can name the
  // hook and the address - and says what to change. Out of production on purpose:
  // a length change is a caller bug to fix, not a condition to handle at runtime.
  const [expectedDepsLength] = useState(deps.length);
  if (
    process.env.NODE_ENV === "development" &&
    deps.length !== expectedDepsLength
  ) {
    throw new Error(
      `useApi: the deps array for ${url} changed length between renders ` +
        `(${expectedDepsLength} -> ${deps.length}). Its size must stay fixed: ` +
        `change a value, or drop the option, but never the number of entries.`,
    );
  }

  // `transform` shapes the answer; it is not part of WHAT is being read. Callers
  // naturally write it inline, which is a new identity on every render - and
  // while that identity was a dependency of the read, every render started
  // another read, exactly as `defaultValue` did above. The newest one is mirrored
  // here instead, so the read stays keyed on the address while the transform in
  // force at fetch time is still the current one. Declared before the read's own
  // effect so it is updated first.
  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  });

  // The same for the request's own options (`{ cache: "no-store" }` and the
  // like): a property of the request, not of what is being read, and written
  // inline by a caller it would be a new object on every render. Mirrored rather
  // than depended on, for the reason just above.
  const fetchOptionsRef = useRef(fetchOptions);
  useEffect(() => {
    fetchOptionsRef.current = fetchOptions;
  });

  const fetchData = useCallback(async (bypassCache = false) => {
    if (!url) return;

    const fetchId = ++fetchIdRef.current;
    setError(null);

    // Stale-while-revalidate: show cached data instantly, refresh in background.
    const cached = bypassCache ? null : cacheGet(url);
    if (cached !== null) {
      const transformFn = transformRef.current;
      setData(transformFn ? transformFn(cached) : cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const { body: json, status: httpStatus } = await fetchJsonEnvelope(
        url,
        fetchOptionsRef.current,
      );

      // Discard stale responses
      if (fetchId !== fetchIdRef.current || !activeRef.current) return;

      // Republishing what is already known must not count as a change: a fresh
      // object here would re-render on every response, and a re-render is what
      // the read above reacts to.
      setLastResponse((previous) =>
        previous && previous.url === url && previous.status === httpStatus
          ? previous
          : { url, status: httpStatus },
      );
      cacheSet(url, json);

      const transformFn = transformRef.current;
      const result = transformFn ? transformFn(json) : json;
      setData(result);
    } catch (fetchError) {
      if (fetchId !== fetchIdRef.current || !activeRef.current) return;
      // A request that threw never produced a response, so there is no status to
      // report: the screen reads this as "no answer", not as "the server said X".
      setLastResponse((previous) =>
        previous && previous.url === url && previous.status === null
          ? previous
          : { url, status: null },
      );
      setError(fetchError.message || "Failed to fetch data");
      console.error(`[useApi] Error fetching ${url}:`, fetchError);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [url]);

  // Fetch on mount / dependency change. The caller's `deps` are spread into the
  // list, so the read is re-issued when any of them changes. The two reports this
  // line carries (a spread the rule cannot verify, and the state written by
  // `fetchData`) are the hook BEING the conversion every screen went through -
  // recorded, not silenced: see docs/DATA_HOOK_MIGRATION.md section 3.7.
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

  return { data, loading, error: visibleError, status, refresh: () => fetchData(true), setData };
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
    } catch (fetchError) {
      if (fetchId !== fetchIdRef.current) return;
      setError(fetchError.message || "Failed to fetch");
      console.error("[useApiMulti] Error:", fetchError);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [endpoints]);

  // Same contract as `useApi`: the caller's `deps` are spread here on purpose.
  useEffect(() => {
    if (!immediate) return;
    fetchAll();
  }, [fetchAll, immediate, ...deps]);

  return { data, loading, error, refresh: () => fetchAll(true), setData };
}
