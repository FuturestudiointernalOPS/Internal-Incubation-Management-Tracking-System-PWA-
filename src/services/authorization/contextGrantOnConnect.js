/**
 * CONTEXT GRANT ON-CONNECT (SERVICE layer).
 *
 * The "connect and receive the changes" path: reconcile every supported context
 * for ONE person, right where their permissions are first read. A facilitator or
 * program manager already in production when this mechanism shipped gets their
 * assignment-derived grants applied at that moment — additively, so nothing they
 * already hold is taken away by the act of connecting.
 *
 * It is cost-bounded by a 5-minute per-person window, and that bound is the
 * design: this is a HOT READ PATH, and a reconcile is 3 × a few queries. Once
 * per window is enough, because grants only change when an assignment, a tick
 * list, a profile or a program end date changes — and every one of those write
 * paths already reconciles directly.
 *
 * `force` exists for the caller that genuinely needs a pass now. The window is
 * keyed on the STRING cid, so a numeric cid still hits its own window rather
 * than silently getting a second reconcile.
 *
 * Split out of `contextGrants.js` (538 lines). Behaviour identical.
 */

import { SUPPORTED_CONTEXT_ROLES } from "./contextGrantPlan";
import { syncContextGrantsForUser } from "./contextGrantReconcile";


const ON_CONNECT_TTL_MS = 5 * 60 * 1000;
const _lastOnConnectSync = new Map();

export async function syncContextGrantsOnConnect(cid, { email = null, force = false } = {}) {
  if (!cid) return { success: false, error: "cid is required" };
  const key = String(cid);
  const last = _lastOnConnectSync.get(key);
  if (!force && last && Date.now() - last < ON_CONNECT_TTL_MS) {
    return { success: true, skipped: true, reason: "within-ttl" };
  }
  _lastOnConnectSync.set(key, Date.now());

  const results = [];
  for (const spec of SUPPORTED_CONTEXT_ROLES) {
    results.push(
      await syncContextGrantsForUser(cid, { ...spec, email }),
    );
  }
  const applied = results.flatMap((result) => result.applied || []);
  const revoked = results.flatMap((result) => result.revoked || []);
  return {
    success: true,
    cid: key,
    contexts: results,
    applied,
    revoked,
    changes: applied.length + revoked.length,
  };
}
