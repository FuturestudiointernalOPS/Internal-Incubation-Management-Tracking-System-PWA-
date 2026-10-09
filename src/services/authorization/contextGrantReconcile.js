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
import {
  buildProfileRoleGap,
  profileKeyForContextRole,
  profileRoleGateDecision,
} from "./profileCatalog";
import { syncContextGrantsAssignments } from "./contextGrantAssignments";
import { logPermissionAudit } from "@/models/authorization/accessQueries";

/**
 * Phase G — record the automatic attribution / withdrawal in the audit log.
 * actor = the system, because no person ran it. Best-effort: a log failure must
 * never take down a reconcile that already wrote the rows. Only ACTUAL opens and
 * closes are logged (a re-date changes no ownership and stays out of the log).
 */
async function logAutomaticAssignmentChanges(cid, context, profileKey, report) {
  const write = async (action, verb, ids) => {
    if (!ids || ids.length === 0) return;
    await logPermissionAudit({
      actorCid: "system",
      actorName: "System",
      targetCid: String(cid),
      targetName: String(cid),
      action,
      details: `Automatic: profile ${profileKey} in ${context} ${verb} [${ids.join(", ")}]`,
    });
  };
  await write("profile_assignment_created", "opened", report.opened);
  await write("profile_assignment_closed", "closed", report.closed);
}
import { syncContextGrantsHistory } from "./contextGrantHistory";

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

    // Phase B — profile ↔ role fit. The couple's profile exists only while the
    // justifying relationship does, so the check runs beside `sourceIds`. In the
    // DEFAULT "warn" mode it is REPORTED and changes nothing; only "block"
    // (Phase H) refuses, before any write, so nothing is applied or revoked.
    const profileKey = await profileKeyForContextRole(context, roleKey);
    const profileRoleGap = sourceIds.length
      ? await buildProfileRoleGap({ profileKey, cid })
      : null;
    const profileGate = profileRoleGateDecision(profileRoleGap);
    if (profileGate.blocked) {
      return {
        success: false,
        cid: String(cid),
        context,
        roleKey,
        error: "profile-role-not-allowed",
        profileRoleGap: profileGate.gap,
      };
    }

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

    // 7. Phase E — the assignment REGISTRY row. The grant above decides ACCESS;
    //    this records that the person HOLDS the profile, per relationship and
    //    per period. Opening a relationship opens the row, ending it closes the
    //    row (never deletes it), and every write is attributable to
    //    `source = 'automatic'`, so a manual Person Access card is never touched.
    const assignmentReport = await syncContextGrantsAssignments(cid, {
      contextType: context,
      profileKey,
      sourceIds,
      endsAt: managesExpiry ? expiresAt : null,
    });

    // Phase G — an automatic open/close IS a permission change, so it is
    // recorded (actor = system) beside the manual entries the Person Access
    // screen already writes.
    await logAutomaticAssignmentChanges(cid, context, profileKey, assignmentReport);

    const assignmentsChanged =
      assignmentReport.opened.length +
        assignmentReport.refreshed.length +
        assignmentReport.closed.length >
      0;

    // 8. Phase F — the RESIDUAL READ. The active grants above are withdrawn when
    //    the relationship ends; this records what the person may still CONSULT:
    //    a `<module>.view` ceiling bounded to the context of the ended cards.
    //    Automatic ended cards only, its own provenance namespace, no expiry.
    const historyReport = await syncContextGrantsHistory(cid, {
      context,
      roleKey,
      profileKey,
    });
    const historyChanged =
      historyReport.applied.length + historyReport.revoked.length > 0;

    const changed = plan.toApply.length > 0 || plan.toRevoke.length > 0;
    if (changed || assignmentsChanged || historyChanged) await invalidateUserContext(cid);

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
      // The Phase B écart (or null when the role fits) — reported, never acted
      // on, in "warn" mode.
      profileRoleGap: profileGate.gap,
      // Phase E — the assignment cards this pass opened / re-dated / closed,
      // tagged with the couple they belong to, for the sweep's report.
      profileAssignments: {
        opened: assignmentReport.opened.map((contextId) => ({
          contextId,
          profileKey,
          context,
        })),
        refreshed: assignmentReport.refreshed.map((contextId) => ({
          contextId,
          profileKey,
          context,
        })),
        closed: assignmentReport.closed.map((contextId) => ({
          contextId,
          profileKey,
          context,
        })),
        skipped: assignmentReport.skipped,
      },
      // Phase F — the residual READ opened / withdrawn this pass (a former
      // manager's consultation).
      profileHistory: {
        applied: historyReport.applied,
        revoked: historyReport.revoked,
        contextIds: historyReport.contextIds,
      },
    };
  } catch (error) {
    console.warn(`[Authz] syncContextGrantsForUser(${cid}) failed:`, error.message);
    return { success: false, cid, error: error.message };
  }
}

export { resolveContextDesiredCaps };

