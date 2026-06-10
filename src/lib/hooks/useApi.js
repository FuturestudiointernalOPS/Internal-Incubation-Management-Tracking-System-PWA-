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
 * @returns {{ data, loading, error, refresh, setData }}
 *
 * @example
 *   const { data: tasks, loading, error, refresh } = useApi("/api/tasks", {
 *     defaultValue: [],
 *     transform: (d) => d.tasks || [],
 *     deps: [filterStatus],
 *   });
 */
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

  // Track latest request to prevent stale responses
  const fetchIdRef = useRef(0);
  const activeRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false);
      setData(defaultValue);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url);
      const json = await res.json();

      // Discard stale responses
      if (fetchId !== fetchIdRef.current || !activeRef.current) return;

      const result = transform ? transform(json) : json;
      setData(result);
    } catch (err) {
      if (fetchId !== fetchIdRef.current || !activeRef.current) return;
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

  return { data, loading, error, refresh: fetchData, setData };
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

  const fetchAll = useCallback(async () => {
    if (!endpoints || endpoints.length === 0) {
      setLoading(false);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        endpoints.map(async ({ key, url, transform }) => {
          if (!url) return { key, value: null };
          const res = await fetch(url);
          const json = await res.json();
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

  return { data, loading, error, refresh: fetchAll, setData };
}
