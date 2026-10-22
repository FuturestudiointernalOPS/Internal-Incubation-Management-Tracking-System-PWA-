/**
 * HISTORICAL ACCESS ADMIN (SERVICE layer).
 *
 * Phase 7, decision D3 (option c): an administrator may **revoke** the residual
 * read-only consultation an ex-manager keeps — and may **restore** it.
 *
 * The revocation is PERSISTED (see the store) so the reconcile cannot silently
 * re-apply it, and it affects ONLY the derived read: the relationship history is
 * never touched (§13). The reconcile already withdraws a residual whose context
 * no longer applies, so revoking simply makes the context "not apply".
 *
 * The AUTHORISATION question ("who may revoke") belongs to the HTTP boundary,
 * which gates on the same permission-centre capability the rest of the screen
 * uses; this module owns the use case: record, withdraw / re-apply, audit, drop
 * the cached context. Never throws — failures are returned as
 * `{ success: false, error }`, like the reconcile it triggers.
 */

import {
  ensureHistoricalRevocationsSchema,
  listHistoricalRevocations,
  upsertHistoricalRevocation,
  deleteHistoricalRevocation,
} from "@/models/authorization/historicalAccessRevocationsStore";
import { logPermissionAudit } from "@/models/authorization/accessQueries";
import { SUPPORTED_CONTEXT_ROLES } from "./contextGrantPlan";
import { syncContextGrantsHistory } from "./contextGrantHistory";
import { invalidateUserContext } from "./contextGrantCache";

/** The context types a residual read can exist for (the supported couples). */
export const REVOCABLE_CONTEXTS = [
  ...new Set(SUPPORTED_CONTEXT_ROLES.map((entry) => entry.context)),
];

/** A context the residual read is derived for — the only revocable ones. */
export function isRevocableContext(context) {
  return REVOCABLE_CONTEXTS.includes(String(context || ""));
}

/** The role keys whose residual reconcile covers one context. */
function roleKeysForContext(context) {
  return SUPPORTED_CONTEXT_ROLES
    .filter((entry) => entry.context === context)
    .map((entry) => entry.roleKey);
}

/**
 * Re-derive the residual for every couple of one context: with the revocation in
 * place this WITHDRAWS, without it this RE-APPLIES. Best-effort per couple, so
 * one unknown profile never blocks the others.
 */
async function reconcileHistory(cid, context) {
  const report = { applied: [], revoked: [] };
  for (const roleKey of roleKeysForContext(context)) {
    const res = await syncContextGrantsHistory(cid, { context, roleKey });
    report.applied.push(...(res.applied || []));
    report.revoked.push(...(res.revoked || []));
  }
  return report;
}

function reasonSuffix(reason) {
  return reason && String(reason).trim() ? ` Reason: ${String(reason).trim()}` : "";
}

/** The person's current revocations (for the retirement screen). */
export async function listRevocations(cid) {
  if (!cid) return { success: false, error: "cid is required" };
  await ensureHistoricalRevocationsSchema();
  const res = await listHistoricalRevocations(cid);
  return { success: true, revocations: res.rows || [] };
}

/**
 * Revoke the residual read for one (person, context). Idempotent: revoking twice
 * refreshes the record and withdraws nothing more.
 */
export async function revokeHistoricalAccess(
  cid,
  context,
  { actorCid = null, actorName = null, reason = "" } = {},
) {
  if (!cid || !isRevocableContext(context)) {
    return { success: false, error: "invalid request" };
  }
  try {
    await ensureHistoricalRevocationsSchema();
    await upsertHistoricalRevocation({ cid, context, revokedBy: actorCid, reason });
    const report = await reconcileHistory(cid, context);
    await logPermissionAudit({
      actorCid,
      actorName,
      targetCid: String(cid),
      targetName: String(cid),
      action: "historical_access_revoked",
      details: `Revoked the historical read for context ${context}${reasonSuffix(reason)}`,
    });
    await invalidateUserContext(cid);
    return { success: true, revoked: report.revoked };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Restore a previously revoked residual. The read is re-derived from the ended
 * cards; if the relationship is still ended it comes back, otherwise nothing
 * applies (the person no longer has a residual to restore).
 */
export async function restoreHistoricalAccess(
  cid,
  context,
  { actorCid = null, actorName = null } = {},
) {
  if (!cid || !isRevocableContext(context)) {
    return { success: false, error: "invalid request" };
  }
  try {
    await ensureHistoricalRevocationsSchema();
    await deleteHistoricalRevocation(cid, context);
    const report = await reconcileHistory(cid, context);
    await logPermissionAudit({
      actorCid,
      actorName,
      targetCid: String(cid),
      targetName: String(cid),
      action: "historical_access_restored",
      details: `Restored the historical read for context ${context}`,
    });
    await invalidateUserContext(cid);
    return { success: true, applied: report.applied };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
