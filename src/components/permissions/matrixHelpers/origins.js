/**
 * Permission Center matrix helpers — capability origins.
 *
 * Reports WHERE a capability comes from (i18n descriptors) so the Person
 * screen can answer "why can they do it?" alongside the effective verdict.
 * Pure: no React, no DB.
 */

/**
 * WHERE a capability comes from — the second question the Person screen has to
 * answer ("why can they do it?"), next to the effective verdict.
 *
 * The rule mirrors the RESOLVER, which does not rank its sources: it takes the
 * MAXIMUM of profile, group and direct grant, removes the capabilities that are
 * explicitly blocked, and gates the whole thing on the feature's eligibility.
 * So (a) every source that holds the capability is reported, not just the
 * strongest one, and (b) a block is reported ALONE: it beats every source, so
 * also claiming "granted directly" on the same line would be false.
 *
 * The order is the one a reader cares about: the personal exception first, then
 * the profile, then the groups.
 *
 * @param {Object} state  deriveUserCapState output
 * @param {{profileName?: string|null, groups?: string[], superAdmin?: boolean}} context
 * @returns {Array<{key: string, params: Object}>} i18n descriptors, never empty
 */
export function describeCapOrigins(
  state,
  { profileName = null, groups = [], superAdmin = false } = {},
) {
  if (!state) return [{ key: ORIGIN_KEYS.none, params: {} }];

  // Eligibility is the outer gate: nothing below it is worth reporting.
  if (state.eligible === false) {
    return [
      { key: "engineering.permissions.effectiveReasonNotEligible", params: {} },
    ];
  }
  // A block removes the capability entirely (resolver semantics).
  if (state.restricted) return [{ key: ORIGIN_KEYS.blocked, params: {} }];

  const origins = [];
  if (state.grant) origins.push({ key: ORIGIN_KEYS.direct, params: {} });
  if (state.profile) {
    origins.push(
      superAdmin
        ? { key: ORIGIN_KEYS.superAdmin, params: {} }
        : profileName
          ? { key: ORIGIN_KEYS.profile, params: { profile: profileName } }
          : { key: ORIGIN_KEYS.profileFallback, params: {} },
    );
  }
  if (state.group) {
    const names = (groups || []).filter(Boolean);
    origins.push(
      names.length
        ? { key: ORIGIN_KEYS.group, params: { group: names.join(", ") } }
        : { key: ORIGIN_KEYS.groupFallback, params: {} },
    );
  }
  if (origins.length === 0) origins.push({ key: ORIGIN_KEYS.none, params: {} });
  return origins;
}

/**
 * Origin labels. Kept here so the report and the editors name a source the
 * same way — the t() keys themselves are resolved by the caller.
 */
export const ORIGIN_KEYS = {
  direct: "engineering.permissions.capOriginDirect",
  profile: "engineering.permissions.capOriginProfile",
  profileFallback: "engineering.permissions.capOriginProfileFallback",
  group: "engineering.permissions.capOriginGroup",
  groupFallback: "engineering.permissions.capOriginGroupFallback",
  superAdmin: "engineering.permissions.capOriginSuperAdmin",
  blocked: "engineering.permissions.capOriginBlocked",
  none: "engineering.permissions.capOriginNone",
};
