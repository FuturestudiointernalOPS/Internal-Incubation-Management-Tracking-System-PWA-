/**
 * CONTEXT GRANT RECONCILE (SERVICE layer).
 *
 * The apply path: resolve one person's justification, plan the change, write the
 * additive rows, revoke only what this mechanism created, and refresh the
 * justifying-relationship list. Idempotent, and it NEVER THROWS — every failure
 * is returned as `{ success: false, error }`.
 *
 * Why it never throws: this runs from a hot read path (on-connect), from
 * membership writes, and from a scheduled sweep. A thrown error in the sweep
 * would abort the remaining people; a returned failure lets the caller report a
 * reason and move on.
 *
 * The steps are ordered for one reason worth naming (step 6): the justifying
 * list AND the expiry are refreshed even when no capability changed, because a
 * program whose END DATE MOVED must re-date its grant even though the
 * capability set is identical. Skipping that would leave a stale expiry in place
 * and access would outlive the program.
 *
 * Two writes, always both: `user_capabilities` AND `context_applied_grants`.
 * The second is the provenance record — without it a later reconcile could not
 * tell which rows it owns and would leave orphans behind on removal.
 *
 * Imports siblings by their focused path, never through the barrel, to stay
 * free of a cycle.
 *
 * Split out of `contextGrants.js` (538 lines). Behaviour identical.
 */

import { initDb } from "@/lib/db";
import { ensureContextAppliedGrantsSchema } from "@/models/authorization/contextGrantsStore";
import {
  getUserCapabilityRows,
  getContextAppliedGrantRows,
  upsertUserCapability,
  upsertContextAppliedGrant,
  deleteUserCapability,
  deleteContextAppliedGrant,
  refreshContextAppliedGrantSource,
  refreshUserCapabilityExpiry,
} from "@/models/authorization/contextGrantsStore";
import { contextGrantSentinel, planContextGrantChanges } from "./contextGrantPlan";
import {
  resolveContextDesiredCaps,
  resolveContextJustification,
} from "./contextGrantJustification";
import { invalidateUserContext } from "./contextGrantCache";

export async function syncContextGrantsForUser(
  cid,
  { context = "venture", roleKey = "founder", email = null } = {},
) {
  try {
    if (!cid) return { success: false, error: "cid is required" };
    await initDb();
    await ensureContextAppliedGrantsSchema();
    const sentinel = contextGrantSentinel(context, roleKey);

    // 1 + 2. Is the justifying relationship still active, and what should the
    //        grant be? (One dispatch for venture founder / program facilitator
    //        / program manager.)
    const support = await resolveContextJustification(cid, {
      context,
      roleKey,
      email,
    });
    if (!support) {
      return {
        success: false,
        cid: String(cid),
        context,
        roleKey,
        error: "unsupported context role",
      };
    }
    const { sourceIds, profile, desired, reason, managesExpiry } = support;
    const expiresAt = managesExpiry ? support.expiresAt : null;
    const resolved = { profile, desired, reason };

    // 3. What exists today (manual grants + what we applied before)?
    const [existingRes, provenanceRes] = await Promise.all([
      getUserCapabilityRows(cid),
      getContextAppliedGrantRows(cid, context, roleKey),
    ]);
    const plan = planContextGrantChanges({
      desired: resolved.desired,
      existing: existingRes?.rows || [],
      provenance: provenanceRes?.rows || [],
      sentinel,
      // Only the program contexts own an expiry. Passing undefined (not null)
      // keeps the venture path's comparison exactly as it was.
      expiresAt: managesExpiry ? expiresAt : undefined,
    });

    // 4. Apply (additive; manual grants are never overwritten by the planner).
    for (const item of plan.toApply) {
      await upsertUserCapability(cid, {
        module: item.module,
        capability: item.capability,
        level: item.level,
        sentinel,
        expiresAt: managesExpiry ? expiresAt : null,
      });
      await upsertContextAppliedGrant(cid, {
        context,
        roleKey,
        sourceRef: sourceIds.join(",") || null,
        module: item.module,
        capability: item.capability,
        level: item.level,
      });
    }

    // 5. Revoke only what this mechanism created (sentinel-guarded).
    for (const item of plan.toRevoke) {
      await deleteUserCapability(cid, item.module, item.capability, sentinel);
      await deleteContextAppliedGrant(cid, context, roleKey, item.module, item.capability);
    }

    // 6. Keep the justifying-relationship list AND the expiry fresh even when
    //    nothing else changed — a program whose end date moved must re-date the
    //    grant even though the capability set did not change.
    if (sourceIds.length > 0 && plan.toApply.length === 0 && plan.toRevoke.length === 0) {
      await refreshContextAppliedGrantSource(cid, context, roleKey, sourceIds.join(","));
      if (managesExpiry) {
        await refreshUserCapabilityExpiry(cid, sentinel, expiresAt);
      }
    }

    const changed = plan.toApply.length > 0 || plan.toRevoke.length > 0;
    if (changed) await invalidateUserContext(cid);

    return {
      success: true,
      cid: String(cid),
      context,
      roleKey,
      profile: resolved.profile,
      // Venture callers read `ventures`; program callers read `programs`. The
      // field name keeps the original contract intact.
      ...(context === "venture"
        ? { ventures: sourceIds }
        : { programs: sourceIds }),
      ...(managesExpiry ? { expiresAt } : {}),
      applied: plan.toApply.map((item) => `${item.module}.${item.capability}`),
      revoked: plan.toRevoke.map((item) => `${item.module}.${item.capability}`),
      reason: resolved.reason,
    };
  } catch (error) {
    console.warn(`[Authz] syncContextGrantsForUser(${cid}) failed:`, error.message);
    return { success: false, cid, error: error.message };
  }
}

export { resolveContextDesiredCaps };

