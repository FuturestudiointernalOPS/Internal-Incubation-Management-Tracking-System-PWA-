/**
 * CONTEXT GRANT CACHE INVALIDATION (SERVICE layer).
 *
 * One function: after the reconcile writes or removes capability rows, the
 * person's cached authorization context has to go, or the Permissions screen and
 * the gate keep serving the pre-write answer for up to the context TTL.
 *
 * The failure contract is the whole point of this module, and it is deliberate:
 * the invalidation runs inside a try/catch and a failure is SWALLOWED. The rows
 * are already written — cache invalidation is a freshness optimisation, and the
 * 60s context TTL bounds the staleness. Reporting the write as failed instead
 * would make the caller retry a revoke that already succeeded, forever.
 *
 * The import is DYNAMIC and the whole call is guarded: it keeps this module free
 * of a static edge back into the context facade, which would drag the whole
 * resolver graph into every grant write.
 *
 * Split out of `contextGrants.js` (538 lines). Behaviour identical.
 */

async function invalidateUserContext(cid) {
  try {
    const { invalidateAuthorizationContext } = await import("./context");
    invalidateAuthorizationContext(String(cid));
  } catch (_) {
    // Cache invalidation is a freshness optimisation; the grant itself is
    // already written and the context TTL (60s) bounds the staleness.
  }
}

export { invalidateUserContext };
