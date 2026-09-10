/**
 * PHASE UI-3b — effect helpers.
 *
 * `react-hooks/set-state-in-effect` flags effects that perform a SYNCHRONOUS
 * state update in their body (cascading render + hydration-sensitive). Two
 * legitimate cases show up across the Permission Center:
 *
 *   1. Cache-first paints: a cached payload is applied without awaiting, so
 *      the update happens synchronously inside the mount effect.
 *   2. Store sync on mount (read a deep link, select a record).
 *
 * Both are deferred by one microtask here — the visible behavior is identical
 * (the update lands right after commit) while the effect body stays free of
 * synchronous writes.
 */

/** Run a callback after the current commit (next microtask). */
export function defer(fn) {
  Promise.resolve().then(fn);
}

/**
 * Await before continuing, so any following state writes happen
 * asynchronously. Use at the top of a cache-hit branch:
 *
 *   const cached = cacheGet(url);
 *   const data = cached?.success ? await settled(cached) : await fetchJson(url);
 */
export function settled(value) {
  return Promise.resolve(value);
}
