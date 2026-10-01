/**
 * CONTEXT GRANT REVOCATION (SERVICE layer).
 *
 * Withdraw every grant this mechanism applied for ONE context/role, regardless
 * of whether the relationship still exists. Used when an administrator clears
 * or DISABLES a mapping and wants the effect applied immediately rather than
 * waiting for the next reconcile to notice.
 *
 * Sentinel-guarded, like everything else in this mechanism: every delete carries
 * `ctx:<context>:<role>`, so a MANUAL grant on the same capability is untouched.
 * The statement is what enforces that, not this loop.
 *
 * The cached context is invalidated only when rows were actually removed — a
 * no-op revoke should not disturb a warm cache.
 *
 * Split out of `contextGrants.js` (538 lines). Behaviour identical.
 */

import { initDb } from "@/lib/db";
import {
  ensureContextAppliedGrantsSchema,
  getContextAppliedGrantPairs,
  deleteUserCapability,
  deleteAllContextAppliedGrants,
} from "@/models/authorization/contextGrantsStore";
import { contextGrantSentinel } from "./contextGrantPlan";
import { invalidateUserContext } from "./contextGrantCache";

export async function revokeAllContextGrants(cid, { context, roleKey }) {
  const sentinel = contextGrantSentinel(context, roleKey);
  try {
    if (!cid) return { success: false, error: "cid is required" };
    await initDb();
    await ensureContextAppliedGrantsSchema();
    const prov = await getContextAppliedGrantPairs(cid, context, roleKey);
    const removed = [];
    for (const row of prov.rows || []) {
      await deleteUserCapability(cid, row.module, row.capability, sentinel);
      removed.push(`${row.module}.${row.capability}`);
    }
    await deleteAllContextAppliedGrants(cid, context, roleKey);
    if (removed.length) await invalidateUserContext(cid);
    return { success: true, cid: String(cid), context, roleKey, revoked: removed };
  } catch (error) {
    console.warn(`[Authz] revokeAllContextGrants(${cid}) failed:`, error.message);
    return { success: false, error: error.message };
  }
}
