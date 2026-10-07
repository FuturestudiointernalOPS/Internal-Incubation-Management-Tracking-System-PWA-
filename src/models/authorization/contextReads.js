/**
 * Authorization — context reads (REPOSITORY layer).
 *
 * The data access behind the authorization decision. Every function here wraps
 * exactly one SQL statement and returns raw rows; none of them decides
 * anything. The decision that consumes them lives in
 * `@/services/authorization/context`.
 *
 * Why this file exists: those statements used to sit inline inside the
 * decision module (`resolver.js`), which meant the module that answers
 * "may they?" also ran SQL and imported HTTP. Splitting them out is what makes
 * the decision testable without a database and keeps the one rule that matters
 * for authorization reads intact — see below.
 *
 * The SQL is byte-identical to the queries that used to live in `resolver.js`.
 * The endpoint test suites mock the database and match on query text, so an
 * identical query is what keeps them a regression net.
 *
 * Layer rules (see docs/LAYER_SPLIT.md):
 *  - No HTTP / Next.js imports here — only the database engine.
 *  - One function per query, named after the data it returns.
 *  - No decisions: callers interpret the rows.
 */

import db from "@/lib/db";

/** Personal capability grants for a user (still-valid rows only). */
export function getUserCapabilityGrants(cid) {
  return db.execute({
    sql: `SELECT module, capability, access_level FROM user_capabilities
          WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())`,
    args: [cid],
  });
}

/** Explicit capability blocks for a user (still-valid rows only). */
export function getUserCapabilityRestrictions(cid) {
  return db.execute({
    sql: `SELECT module, capability FROM user_capability_restrictions
          WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())`,
    args: [cid],
  });
}

/** The person's profile override and their group fallback. */
export function getContactAccessProfileAndGroup(cid) {
  return db.execute({
    sql: "SELECT access_profile_id, profile_key, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/**
 * The BASE profile a person's override names — by PROFILE KEY.
 *
 * ONE statement on purpose: the resolver's wave count is pinned by
 * `db-sequencing.test.js`.
 *
 * @returns rows shaped `{ profile_key, label }`
 */
export function resolveContactBaseProfile({ profileKey = null }) {
  return db.execute({
    sql: `SELECT p.key AS profile_key, p.label AS label
          FROM profiles p
          WHERE p.key = ? AND p.is_active = 1`,
    args: [profileKey],
  });
}

/**
 * The BASE profile a role defaults to — `role_profile_defaults`, by KEY. ONE
 * statement for the same wave-count reason.
 *
 * @returns rows shaped `{ profile_key, label }`
 */
export function resolveRoleDefaultBaseProfile(role) {
  return db.execute({
    sql: `SELECT rpd.profile_key AS profile_key, p.label AS label
          FROM role_profile_defaults rpd
          JOIN profiles p ON p.key = rpd.profile_key
          WHERE rpd.role_name = ? AND p.is_active = 1`,
    args: [role],
  });
}

/**
 * The BASE capability rows for a person: the resolved profile's rows when there
 * is one, otherwise the identity's `role_capabilities` rows. Exactly one
 * statement runs.
 */
export function getBaseCapabilityRows({ profileKey, role }) {
  if (profileKey) {
    return db.execute({
      sql: "SELECT module, capability, access_level FROM profile_capabilities WHERE profile_key = ?",
      args: [profileKey],
    });
  }
  return db.execute({
    sql: "SELECT module, capability, access_level FROM role_capabilities WHERE role = ?",
    args: [role],
  });
}

/**
 * Capability rows granted by every group the person belongs to, in one query.
 * Returns an empty result (no query) for a person with no groups.
 */
export function getGroupCapabilityRows(groups) {
  if (!groups || groups.length === 0) return Promise.resolve({ rows: [] });
  const placeholders = groups.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT module, capability, access_level FROM group_capabilities
                WHERE group_name IN (${placeholders})`,
    args: groups,
  });
}

/**
 * Eligibility rows for a role, its groups and its active PROFILES, in one query.
 *
 * The role/group branch is byte-identical to the statement that existed before
 * profiles (the endpoint suites match on SQL text); the profile branch is added
 * only when the person actually holds profiles, so an identity with none pays
 * exactly the query it always did. Profile rows OR with the others, exactly like
 * role and group rows (any allow; an explicit deny still wins in the decision).
 */
export function getFeatureEligibilityRows(role, groups, profiles = []) {
  const placeholders = groups.length ? groups.map(() => "?").join(",") : "NULL";
  if (!profiles || profiles.length === 0) {
    return db.execute({
      sql: `SELECT feature_key, identity_type, identity_value, eligible
            FROM feature_eligibility
            WHERE (identity_type = 'role' AND identity_value = ?)
               OR (identity_type = 'group' AND identity_value IN (${placeholders}))`,
      args: [role, ...groups],
    });
  }
  const profilePlaceholders = profiles.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT feature_key, identity_type, identity_value, eligible
            FROM feature_eligibility
            WHERE (identity_type = 'role' AND identity_value = ?)
               OR (identity_type = 'group' AND identity_value IN (${placeholders}))
               OR (identity_type = 'profile' AND identity_value IN (${profilePlaceholders}))`,
    args: [role, ...groups, ...profiles],
  });
}
