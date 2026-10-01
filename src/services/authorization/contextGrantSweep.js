/**
 * CONTEXT GRANT SWEEPS (SERVICE layer).
 *
 * The bulk paths: reconcile every holder of a justifying relationship, and
 * reconcile every supported context at once.
 *
 *   - `syncAllContextGrants` is the backfill and drift-repair entry point for
 *     ONE context/role pair. Safe to re-run.
 *   - `syncAllContextGrantsEverywhere` runs every supported pair and aggregates
 *     them. This is also how access ENDS: when a program's end date passes, or
 *     it is completed/archived, the assignment stops being active and this pass
 *     withdraws the grants it justified.
 *
 * The population set has TWO sources on purpose:
 *
 *   - people who currently hold a relationship, and
 *   - people whose PROVENANCE rows exist, because their relationship ENDED.
 *
 * The second source is why a sweep can remove access at all. Without it, ending
 * a relationship would leave the granted rows in place forever, since the person
 * is no longer in the active set.
 *
 * On the aggregate: `success` is true only when EVERY context succeeded, and the
 * flat `evaluated`/`applied`/`revoked`/`changes` shape is preserved alongside
 * the per-context detail, because earlier phases' consumers read the flat four.
 * A sweep that reported success while one context failed would let a scheduled
 * run look green while access silently lingered.
 *
 * Split out of `contextGrants.js` (538 lines). Behaviour identical.
 */

import { initDb } from "@/lib/db";
import {
  ensureContextAppliedGrantsSchema,
  listFounderRelationshipCids,
  listContextAppliedGrantCids,
} from "@/models/authorization/contextGrantsStore";
import { listProgramAssignmentContacts } from "@/models/authorization/programAssignmentReads";
import { SUPPORTED_CONTEXT_ROLES } from "./contextGrantPlan";
import { syncContextGrantsForUser } from "./contextGrantReconcile";

export async function syncAllContextGrants(
  { context = "venture", roleKey = "founder" } = {},
) {
  try {
    await initDb();
    await ensureContextAppliedGrantsSchema();

    const cids = new Set();
    if (context === "venture" && roleKey === "founder") {
      const relRes = await listFounderRelationshipCids();
      for (const row of relRes.rows || []) if (row.cid) cids.add(String(row.cid));
    } else if (context === "program") {
      // Everyone who currently holds a program assignment (any role — the
      // per-role split happens inside the per-user reconcile).
      for (const cid of await listProgramAssignmentContacts()) cids.add(cid);
    }
    // People whose relationship ended still need a pass so their applied rows
    // are removed.
    const provRes = await listContextAppliedGrantCids(context, roleKey);
    for (const row of provRes.rows || []) if (row.cid) cids.add(String(row.cid));

    const results = [];
    for (const cid of cids) {
      results.push(await syncContextGrantsForUser(cid, { context, roleKey }));
    }

    const applied = results.flatMap((result) => result.applied || []);
    const revoked = results.flatMap((result) => result.revoked || []);
    return {
      success: true,
      context,
      roleKey,
      evaluated: results.length,
      applied,
      revoked,
      changes: applied.length + revoked.length,
      results,
    };
  } catch (error) {
    console.warn("[Authz] syncAllContextGrants failed:", error.message);
    return { success: false, error: error.message };
  }
}

export async function syncAllContextGrantsEverywhere() {
  const contexts = [];
  for (const spec of SUPPORTED_CONTEXT_ROLES) {
    contexts.push(await syncAllContextGrants(spec));
  }
  const applied = contexts.flatMap((contextResult) => contextResult.applied || []);
  const revoked = contexts.flatMap((contextResult) => contextResult.revoked || []);
  return {
    success: contexts.every((contextResult) => contextResult.success !== false),
    contexts: contexts.map((contextResult) => ({
      context: contextResult.context,
      roleKey: contextResult.roleKey,
      evaluated: contextResult.evaluated ?? 0,
      applied: contextResult.applied || [],
      revoked: contextResult.revoked || [],
      changes: contextResult.changes ?? 0,
    })),
    evaluated: contexts.reduce((sum, contextResult) => sum + (contextResult.evaluated ?? 0), 0),
    applied,
    revoked,
    changes: applied.length + revoked.length,
  };
}

