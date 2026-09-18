/**
 * WORKSPACE CONTEXT CACHE — the navigation list, per person.
 *
 * The page shell asks for the contexts a person can act in every time it mounts,
 * on every page. That list is derived from the person's access and changes when -
 * and only when - their access changes, which is rare: re-reading the tables
 * behind it on every page load makes every navigation pay for facts that are
 * almost always the same ones.
 *
 * WHAT IS CACHED, and what deliberately is not: the derived navigation payload
 * (`workspaces` + `contexts`). The identity chip is NOT here. It is composed from
 * the session plus one small read that is intentionally fresh (see the route), so
 * a cached list can never mislabel the person it belongs to.
 *
 * WHY THE INVALIDATION IS NOT A RULE OF ITS OWN: this data is a function of the
 * same access facts the authorization context is resolved from, so it is dropped
 * by the SAME calls that drop that one - the writes behind every grant, role,
 * profile, group and eligibility change. A writer that remembers to drop the
 * gated view has dropped the navigation view with it, and a future writer cannot
 * drop one without the other.
 *
 * The TTL is therefore the backstop rather than the mechanism. It covers the
 * writes that do NOT pass through those calls (assigning someone to a programme,
 * adding a venture membership), which appear on the next mount after the window
 * instead of immediately.
 */
const TTL_MS = 30_000;
const MAX_ENTRIES = 2000;

/** `${cid}|${scope}` → { payload, expires }. Two entries per person at most. */
const _cache = new Map();

/** One person, one scope ("contexts" for the shell, "full" for the hub page). */
const keyFor = (cid, scope) => `${cid}|${scope}`;

/** The cached navigation payload for one person and scope, or null. */
export function readWorkspaceContext(cid, scope) {
  if (!cid) return null;
  const key = keyFor(cid, scope);
  const hit = _cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    _cache.delete(key);
    return null;
  }
  return hit.payload;
}

/** Store one person's payload for one scope (evicting the oldest over the cap). */
export function writeWorkspaceContext(cid, scope, payload) {
  if (!cid) return;
  _cache.set(keyFor(cid, scope), {
    payload,
    expires: Date.now() + TTL_MS,
  });
  if (_cache.size > MAX_ENTRIES) {
    const oldestKey = _cache.keys().next().value;
    if (oldestKey !== undefined) _cache.delete(oldestKey);
  }
}

/** Drop one person's cached navigation, in every scope. */
export function dropWorkspaceContext(cid) {
  if (!cid) return;
  const prefix = `${cid}|`;
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

/** Drop every cached navigation list. */
export function dropAllWorkspaceContexts() {
  _cache.clear();
}

/** Test seam. */
export function resetWorkspaceContextCache() {
  _cache.clear();
}
