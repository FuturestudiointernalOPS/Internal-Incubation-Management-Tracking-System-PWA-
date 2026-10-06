/**
 * AUTHORIZATION CONTEXT CACHE (SERVICE layer).
 *
 * Resolve ONCE per identity per TTL window and reuse. The cache is keyed on
 * `cid|role` and NOT on cid alone: a role change alters the effective matrix,
 * so serving the pre-change entry would hand someone their previous role's
 * access.
 *
 * Two behaviours worth naming, both pinned by tests:
 *
 *   - INFLIGHT SHARING. A cold page load fires several authorized requests at
 *     once; without it each would run the same resolution in parallel. The
 *     first caller resolves and the others await the same promise. A REJECTED
 *     resolution is not cached and its inflight entry is cleared in `finally`,
 *     so the next caller retries instead of replaying the failure forever.
 *   - INVALIDATION IS PREFIX-BASED AND COUPLED. Dropping a user's context also
 *     drops the workspace context, because the post-login navigation list is
 *     derived from the same access facts — whoever remembers one has dropped
 *     the other, and a future writer cannot drop one without the other.
 *
 * TTL is 60s and egress-neutral: permission writes invalidate immediately.
 *
 * Split out of `context.js` (560 lines). Behaviour identical.
 */

import {
  dropWorkspaceContext,
  dropAllWorkspaceContexts,
} from "@/lib/workspaceContextCache";
import { resolveAuthorizationContext } from "./contextResolver";

const AUTHZ_CONTEXT_TTL_MS = 60000; // 60s context cache (egress-neutral; invalidated immediately on permission writes)
const _authzContextCache = new Map();
// Contexts currently being resolved, keyed like the cache. A page load issues
// several authorized requests at once; on a cold cache they all miss the check
// above and each would run the same ~6 resolution queries in parallel (observed
// as a burst of identical slow queries). The first caller resolves; the others
// await the same promise.
const _authzContextInflight = new Map();

/**
 * Cached context accessor — resolve ONCE per user per TTL window and reuse.
 * Compatible with the existing serverless architecture (mirrors the 5s
 * _sessionCache pattern in auth.js, extended to 10s for authorization).
 */
export async function getAuthorizationContext(user) {
  if (!user?.cid) return null;
  const key = `${user.cid}|${user.role || ""}`;
  const cached = _authzContextCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.ctx;

  // Share one resolution between callers that arrive before it completes.
  const inflight = _authzContextInflight.get(key);
  if (inflight) return inflight;

  const pending = resolveAuthorizationContext(user)
    .then((ctx) => {
      _authzContextCache.set(key, { ctx, expires: Date.now() + AUTHZ_CONTEXT_TTL_MS });
      return ctx;
    })
    .finally(() => {
      if (_authzContextInflight.get(key) === pending) {
        _authzContextInflight.delete(key);
      }
    });

  _authzContextInflight.set(key, pending);
  return pending;
}

/**
 * Drop a user's cached context (call after grant/restrict/profile/role writes).
 *
 * The post-login navigation list is derived from the same access facts, so it is
 * dropped here too rather than at its own set of call sites: whoever remembers to
 * drop this one has dropped that one, and a future writer cannot drop one without
 * the other (see src/lib/workspaceContextCache.js).
 */
export function invalidateAuthorizationContext(cid) {
  if (!cid) return;
  for (const key of _authzContextCache.keys()) {
    if (key.startsWith(`${cid}|`)) _authzContextCache.delete(key);
  }
  for (const key of _authzContextInflight.keys()) {
    if (key.startsWith(`${cid}|`)) _authzContextInflight.delete(key);
  }
  dropWorkspaceContext(cid);
}

/**
 * Drop ALL cached contexts (call after eligibility configuration writes — a
 * role/group change can affect any user). The cache is small and short-TTL
 * (10s), so a full clear is egress-safe.
 */
export function invalidateAllAuthorizationContexts() {
  _authzContextCache.clear();
  _authzContextInflight.clear();
  dropAllWorkspaceContexts();
}
