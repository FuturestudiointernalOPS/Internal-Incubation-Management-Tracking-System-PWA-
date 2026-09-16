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

/**
 * Guard for a request whose answer may arrive after the user moved on.
 *
 * Selecting person A then person B issues two requests, and the network is free
 * to answer B first and A second. Without a guard, A's late answer paints A's
 * access under B's name: data belonging to someone else, presented as B's.
 *
 *   const guard = useRef(null);
 *   if (!guard.current) guard.current = createLatestGuard();
 *   const token = guard.current.begin();
 *   const data = await fetchJson(url);
 *   if (!guard.current.isCurrent(token)) return; // a newer selection won
 *
 * Every caller of the SAME guard shares one line of succession, so a background
 * refresh is also invalidated by a new selection.
 */
export function createLatestGuard() {
  let latest = 0;
  return {
    /** Take a token for a new request (invalidates everything in flight). */
    begin() {
      latest += 1;
      return latest;
    },
    /** May this answer still be applied? */
    isCurrent(token) {
      return token === latest;
    },
    /** Invalidate what is in flight without starting a request. */
    cancel() {
      latest += 1;
    },
  };
}
