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
    sql: "SELECT access_profile_id, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** An active access profile by id — used to validate a person's override. */
export function getActiveAccessProfileById(profileId) {
  return db.execute({
    sql: "SELECT id, name FROM access_profiles WHERE id = ? AND is_active = 1",
    args: [profileId],
  });
}

/** A role's active default access profile. */
export function getRoleDefaultAccessProfile(role) {
  return db.execute({
    sql: `SELECT ap.id, ap.name
                FROM role_access_profile_defaults rpd
                JOIN access_profiles ap ON ap.id = rpd.access_profile_id
                WHERE rpd.role_name = ? AND ap.is_active = 1`,
    args: [role],
  });
}

/**
 * The BASE capability rows for a person: the assigned profile's rows when there
 * is one, otherwise the legacy role rows. Exactly one statement runs.
 */
export function getBaseCapabilityRows({ profileId, role }) {
  return profileId
    ? db.execute({
        sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?",
        args: [profileId],
      })
    : db.execute({
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
 * Eligibility rows for a role, its groups and the CONTEXT roles it holds, in
 * one query. The placeholders keep the original `NULL` fallback for a person
 * with no groups.
 *
 * `contextRoles` (venture founder / venture member, program participant,
 * facilitator…) belong here because the engine enforces a context role as a
 * ceiling too, and a person carries ONE stored role. Without them, a founder
 * whose stored role is `facilitator` would only ever be checked as a
 * facilitator and would be denied the Venture they founded — the bug this
 * parameter closes.
 */
export function getFeatureEligibilityRows(role, groups, contextRoles = []) {
  const placeholders = groups.length ? groups.map(() => "?").join(",") : "NULL";
  const identities = [role, ...contextRoles].filter(
    (identity, index, all) => identity && all.indexOf(identity) === index,
  );
  const rolePlaceholders = identities.length ? identities.map(() => "?").join(",") : "NULL";
  return db.execute({
    sql: `SELECT feature_key, identity_type, identity_value, eligible
            FROM feature_eligibility
            WHERE (identity_type = 'role' AND identity_value IN (${rolePlaceholders}))
               OR (identity_type = 'group' AND identity_value IN (${placeholders}))`,
    args: [...identities, ...groups],
  });
}

/**
 * The CONTEXT roles this person holds right now — the eligibility identities
 * that are true of them because of a relationship, not because of their stored
 * role:
 *
 *   venture founder       → 'founder'   (venture_members.member_type)
 *   other venture member  → 'member'
 *   program enrollment    → 'participant'
 *   program assignment    → 'facilitator'
 *
 * Best-effort: a context that cannot be read contributes nothing rather than
 * breaking the whole resolution (the same tolerance the scope reads use).
 */
export async function getContextEligibilityRoles(cid) {
  if (!cid) return { rows: [] };
  try {
    return await db.execute({
      sql: `SELECT DISTINCT role_key FROM (
              SELECT 'founder' AS role_key FROM venture_members
               WHERE (contact_id = ? OR user_cid = ?) AND removed_at IS NULL
                 AND member_type = 'founder'
              UNION
              SELECT 'member' AS role_key FROM venture_members
               WHERE (contact_id = ? OR user_cid = ?) AND removed_at IS NULL
                 AND (member_type IS NULL OR member_type <> 'founder')
              UNION
              SELECT 'participant' AS role_key FROM participant_programs
               WHERE participant_id = ?
              UNION
              SELECT 'facilitator' AS role_key FROM v2_program_staff
               WHERE role = 'facilitator'
                 AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?))
            ) context_roles`,
      args: [cid, cid, cid, cid, cid, cid, cid],
    });
  } catch (_) {
    return { rows: [] };
  }
}
