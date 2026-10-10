/**
 * CONTEXT GRANT HISTORY (SERVICE layer).
 *
 * Phase F of docs/ROADMAP_ROLES_PROFILES_ACCESS.md — the RESIDUAL READ.
 *
 * When a managed relationship ends, the active grants are withdrawn (that is the
 * point of expiry), but the person keeps a READ-ONLY view of what they managed:
 * an "ancien gestionnaire" may still CONSULT the programs/ventures they ran,
 * without any of the management rights the profile granted.
 *
 * Two notions, kept apart on purpose:
 *
 *   ACTIVE   = the relationship holds  → the profile's grants (management).
 *   HISTORY  = the relationship ended  → a `<module>.view` ceiling at level 1,
 *              bounded to the context of the assignment, and nothing else.
 *
 * Isolation (why active and history never touch each other):
 *   - a DISTINCT provenance role_key (`history:<role>`) — the active reconcile
 *     reads and revokes only its own `role_key`, so it can never see these rows;
 *   - a DISTINCT grant stamp (`hist:<context>:<role>`) — `deleteUserCapability`
 *     is stamp-guarded, so neither side can remove the other's rows.
 *
 * The residual is derived ONLY from `source = 'automatic'` ENDED cards, so a card
 * written by hand from the Person Access screen is never turned into a residual.
 *
 * D3 — the residual now EXPIRES: its `expires_at` is the end of responsibility
 * (the latest ended card) plus a configurable retention (default 6 months,
 * `system_settings.historical_access_retention`). The resolver already drops
 * expired grants, so writing the date is what ends the access. The residual also
 * disappears when it no longer applies (the relationship is reopened) or when an
 * administrator removes it.
 *
 * No HTTP. The SQL lives in the models the header names.
 */

import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { CAPABILITY_CATALOG } from "@/models/authorization/capability-catalog";
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
import {
  ensureProfileAssignmentsSchema,
  listEndedAutomaticAssignments,
} from "@/models/authorization/profileAssignmentsStore";
import {
  planContextGrantChanges,
  historicalGrantSentinel,
  historicalRoleKey,
} from "./contextGrantPlan";
import { profileKeyForContextRole } from "./profileCatalog";
import {
  DEFAULT_HISTORICAL_RETENTION,
  HISTORICAL_RETENTION_SETTING_KEY,
  historicalExpiryFor,
  parseHistoricalRetention,
} from "./historicalAccess";
import { getSystemSettingValue } from "@/models/authorization/historicalAccessReads";
import { getHistoricalRevocation } from "@/models/authorization/historicalAccessRevocationsStore";

/** The dashboard feature each persona context belongs to. */
const CONTEXT_TO_FEATURE = {
  program: "programs",
  venture: "ventures",
  lms: "lms",
  investor: "investors",
};

/**
 * The current retention (Super-Admin setting), defaulting on any failure so a
 * missing table or row can never leave the residual unbounded by accident.
 */
async function readHistoricalRetention() {
  try {
    const res = await getSystemSettingValue(HISTORICAL_RETENTION_SETTING_KEY);
    return parseHistoricalRetention(res?.rows?.[0]?.setting_value);
  } catch {
    return { ...DEFAULT_HISTORICAL_RETENTION };
  }
}

/**
 * PURE. The read-only capabilities a context grants as a residual: every module
 * of the context's feature that HAS a `view` capability, at level 1. A module
 * with no `view` (the facilitator block) grants nothing here — there is no
 * "consult" it could stand for.
 *
 * @param {string} context
 * @returns {Object<string, {module, capability, level}>} "module.view" entries
 */
export function readingCapabilitiesForContext(context) {
  const feature = CONTEXT_TO_FEATURE[String(context || "")];
  const desired = {};
  if (!feature) return desired;
  for (const [module, moduleFeature] of Object.entries(MODULE_TO_FEATURE)) {
    if (moduleFeature !== feature) continue;
    if (!CAPABILITY_CATALOG[module]?.capabilities?.view) continue;
    desired[`${module}.view`] = { module, capability: "view", level: 1 };
  }
  return desired;
}

/** The distinct context ids of a set of ended cards (nulls dropped). */
export function endedContextIds(rows = []) {
  const ids = new Set();
  for (const row of rows) {
    const id = row?.context_id;
    if (id === null || id === undefined || id === "") continue;
    ids.add(String(id));
  }
  return [...ids];
}

/**
 * Apply the residual read for ONE person and ONE couple.
 *
 * Never throws: a failure is returned as a reason, like the rest of the
 * mechanism, so the calling reconcile (also non-throwing) reports it and moves
 * on. A couple whose profile the catalogue does not know is skipped — there is
 * no context to bound the read to.
 *
 * @param {string} cid
 * @param {{context: string, roleKey: string, profileKey?: string|null}} args
 * @returns {Promise<{applied: string[], revoked: string[], contextIds: string[],
 *   error?: string}>}
 */
export async function syncContextGrantsHistory(
  cid,
  { context, roleKey, profileKey = null } = {},
) {
  const empty = { applied: [], revoked: [], contextIds: [] };
  if (!cid || !context || !roleKey) return empty;
  const key = profileKey || (await profileKeyForContextRole(context, roleKey));
  if (!key) return empty; // unknown couple — nothing to bound a read to

  try {
    await ensureProfileAssignmentsSchema();
    const sentinel = historicalGrantSentinel(context, roleKey);
    const provenanceKey = historicalRoleKey(roleKey);

    const endedRes = await listEndedAutomaticAssignments({
      contactCid: cid,
      profileKey: key,
      contextType: context,
    });
    const contextIds = endedContextIds(endedRes?.rows || []);
    // D3 2/2 — an administrator REVOKED the residual for this context: no read is
    // derived, and anything already written is withdrawn (the provenance rows
    // become the plan's `toRevoke` list, so the deletion stays sentinel-guarded).
    const revokedRes = await getHistoricalRevocation(cid, context);
    const isRevoked = (revokedRes?.rows || []).length > 0;
    // No ended card (or a revocation) → no residual: reopening the relationship,
    // or a revocation, is what withdraws it.
    const applying = !isRevoked && contextIds.length > 0;
    const desired = applying ? readingCapabilitiesForContext(context) : {};
    // D3 — the residual expires `retention` AFTER the end of responsibility.
    // Anchored on the ended cards' stored dates, so the reconcile stays
    // idempotent (a `now`-based expiry would re-date the row on every pass).
    const expiresAt = applying
      ? historicalExpiryFor(endedRes?.rows || [], await readHistoricalRetention())
      : null;

    const [existingRes, provenanceRes] = await Promise.all([
      getUserCapabilityRows(cid),
      getContextAppliedGrantRows(cid, context, provenanceKey),
    ]);
    const plan = planContextGrantChanges({
      desired,
      existing: existingRes?.rows || [],
      provenance: provenanceRes?.rows || [],
      sentinel,
      // D3 — when there IS a residual, its expiry is managed so a retention
      // change re-dates it; with no ended card (or a revocation) there is
      // nothing to manage.
      expiresAt: applying ? expiresAt : undefined,
    });

    const applied = [];
    for (const item of plan.toApply) {
      await upsertUserCapability(cid, {
        module: item.module,
        capability: item.capability,
        level: item.level,
        sentinel,
        expiresAt,
      });
      await upsertContextAppliedGrant(cid, {
        context,
        roleKey: provenanceKey,
        sourceRef: contextIds.join(",") || null,
        module: item.module,
        capability: item.capability,
        level: item.level,
        mode: "historical",
      });
      applied.push(`${item.module}.${item.capability}`);
    }

    const revoked = [];
    for (const item of plan.toRevoke) {
      await deleteUserCapability(cid, item.module, item.capability, sentinel);
      await deleteContextAppliedGrant(cid, context, provenanceKey, item.module, item.capability);
      revoked.push(`${item.module}.${item.capability}`);
    }

    // Keep the justifying context list fresh when nothing else changed, and
    // re-date the expiry (a retention change must move the residual's end).
    if (applying && applied.length === 0 && revoked.length === 0) {
      await refreshContextAppliedGrantSource(cid, context, provenanceKey, contextIds.join(","));
      await refreshUserCapabilityExpiry(cid, sentinel, expiresAt);
    }

    return { applied, revoked, contextIds };
  } catch (error) {
    console.warn(`[Authz] syncContextGrantsHistory(${cid}) failed:`, error.message);
    return { ...empty, error: error.message };
  }
}
