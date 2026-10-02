/**
 * ELIGIBILITY CONFIGURATION DECISIONS (SERVICE layer).
 *
 * `src/app/api/engineering/permissions/eligibility/route.js` decided who may
 * configure the eligibility matrix, which roles to surface beyond the agreed
 * list, which groups to offer, whether a downgrade strands template-granted
 * capabilities (the C2 probe), how a change becomes an upsert or a delete,
 * and what the audit trail says. Those decisions move here.
 *
 * Rules, unchanged:
 *   - `canConfigure` is a SOFT gate. It never blocks the read: a caller with
 *     only view_matrix still receives the whole catalog, and the flag tells the
 *     UI which writes to grey out. It is coerced to a real boolean, so the JSON
 *     never carries null/undefined.
 *   - `extraRoles` is derived from the DATA (identity rows ∪ role defaults),
 *     never from a new allowlist, so a ceiling the engine already enforces can
 *     never become invisible — that is exactly how Staff Default became
 *     unsavable. Agreed identities are subtracted, blanks dropped, sorted.
 *   - `groups` is the union of `user_groups` and the `contacts.group_name`
 *     fallback, deduplicated and sorted.
 *   - C2: an eligibility DOWNGRADE (0 or unset) can strand capabilities that
 *     role-default TEMPLATES still grant. Nothing is deleted automatically —
 *     the first attempt reports the impacted templates and waits for an
 *     explicit confirmation. Every downgrade is probed, so the admin sees the
 *     complete picture in one round trip rather than fixing problems one at a
 *     time. Only roles are probed: templates are role defaults.
 *   - eligible 1/0 → upsert (0 is an explicit DENY, still a row);
 *     eligible null → delete (fail-closed unset).
 */

import { authorize } from "./context";
import { ELIGIBILITY_IDENTITIES } from "./eligibilityAdmin";

/**
 * Whether the caller may CONFIGURE eligibility. A soft flag, not a gate.
 *
 * @param {object} authorizationContext
 * @returns {boolean} always a real boolean, never null/undefined
 */
export function resolveCanConfigure(authorizationContext) {
  return !!authorize(authorizationContext, "permissions", "configure_eligibility");
}

/**
 * The group names the eligibility matrix should offer: `user_groups` plus the
 * legacy `contacts.group_name` fallback, deduplicated and sorted.
 *
 * @param {Array<{group_name: string}>} userGroupRows
 * @param {Array<{group_name: string}>} contactGroupRows
 * @returns {string[]}
 */
export function deriveEligibleGroupNames(userGroupRows, contactGroupRows) {
  return [
    ...new Set(
      [...(userGroupRows || []), ...(contactGroupRows || [])].map((row) => row.group_name),
    ),
  ].sort();
}

/**
 * The roles this database enforces that the agreed identity list does not
 * carry — the resolver consults them, so the administrator must be able to see
 * and configure those ceilings from the eligibility screen.
 *
 * @param {Array<{identity_value: string}>} eligibilityRoleRows
 * @param {Array<{role_name: string}>} roleDefaultRows
 * @returns {string[]} sorted, blanks dropped, agreed identities subtracted
 */
export function deriveExtraRoles(eligibilityRoleRows, roleDefaultRows) {
  const agreed = new Set(ELIGIBILITY_IDENTITIES);
  return [
    ...new Set([
      ...(eligibilityRoleRows || []).map((row) => row.identity_value),
      ...(roleDefaultRows || []).map((row) => row.role_name),
    ]),
  ]
    .filter((identity) => identity && !agreed.has(identity))
    .sort();
}

/**
 * The changes that may strand template-granted capabilities: a role DOWNGRADE,
 * i.e. eligible 0 or an unset (null). Upgrades (1) are never probed, and a
 * group identity is never probed because templates are role defaults.
 *
 * @param {Array<{identity_type: string, identity_value: string, eligible: number|null}>} normalized
 * @returns {Array} the subset to probe, in the order the caller supplied
 */
export function selectTemplateImpactCandidates(normalized) {
  return (normalized || []).filter(
    (change) => change.identity_type === "role" && change.eligible !== 1,
  );
}

/**
 * Folds the probe rows of ONE change into the templates they belong to.
 *
 * The probe returns one row per (template, capability), so the same template
 * shows up several times; it is reported once, carrying its capabilities as
 * `module.capability` strings in the order the probe returned them.
 *
 * @param {Array<{id: number, name: string, module: string, capability: string}>} rows
 * @returns {Array<{id: number, name: string, capabilities: string[]}>}
 */
export function foldImpactedTemplates(rows) {
  const byTemplate = new Map();
  for (const row of rows || []) {
    if (!byTemplate.has(row.id)) {
      byTemplate.set(row.id, { id: row.id, name: row.name, capabilities: [] });
    }
    byTemplate.get(row.id).capabilities.push(`${row.module}.${row.capability}`);
  }
  return [...byTemplate.values()];
}

/**
 * C2 — the impact report that makes the admin decide knowingly.
 *
 * Every candidate downgrade is probed; a candidate whose probe finds no
 * template is simply absent from the report. An empty result means the
 * downgrade is safe and applies without confirmation.
 *
 * @param {Array<{identity_value: string, feature_key: string}>} candidates
 * @param {(role: string, feature: string) => Promise<{rows?: Array}>} probe the
 *   model read, returning its result set as-is
 * @returns {Promise<Array<{role: string, feature: string, templates: Array}>>}
 */
export async function collectTemplateImpacts(candidates, probe) {
  const impacts = [];
  for (const change of candidates) {
    const result = await probe(change.identity_value, change.feature_key);
    const templates = foldImpactedTemplates(result?.rows);
    if (templates.length > 0) {
      impacts.push({
        role: change.identity_value,
        feature: change.feature_key,
        templates,
      });
    }
  }
  return impacts;
}

/**
 * Whether a validated change deletes its row or upserts it.
 *
 * @param {{eligible: number|null}} change
 * @returns {{operation: "delete"} | {operation: "upsert"}}
 */
export function resolveEligibilityWrite(change) {
  return { operation: change.eligible === null ? "delete" : "upsert" };
}

/**
 * The audit sentence for a change: what it was, what it became, with `unset`
 * for both a missing previous value and a removal.
 *
 * @param {{feature_key: string, identity_type: string, identity_value: string, eligible: number|null}} change
 * @param {{eligible: number}|null|undefined} previousRow the row as read BEFORE the write
 * @returns {string}
 */
export function formatEligibilityAuditDetails(change, previousRow) {
  const prevValue = previousRow ? Number(previousRow.eligible) : null;
  const previous = prevValue === null ? "unset" : prevValue;
  const next = change.eligible === null ? "unset" : change.eligible;
  return `${change.feature_key} ${change.identity_type}:${change.identity_value} ${previous} → ${next}`;
}