import db from "@/lib/db";

/**
 * Base-capability reads (repository layer).
 *
 * A person's BASE capabilities are resolved by a precedence — an active profile
 * override wins, else the role's active default profile, else the legacy
 * `role_capabilities` rows. The four statements below only feed that rule; the
 * rule itself lives in `@/services/authorization/baseCapabilities`.
 *
 * Statements are byte-identical to the ones they were lifted from
 * (`@/models/authorization`), so the API jest suites that match on SQL text keep
 * intercepting. One function per query, named after the data.
 */

/**
 * The contact's baseline identity plus any explicit profile override.
 * `access_profile_id` is what decides whether the override probe is run at all.
 */
export async function getContactBaseState(userCid) {
  return db.execute({
    sql: "SELECT role, access_profile_id FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

/**
 * The role's ACTIVE default profile. An inactive default is skipped by the
 * resolver, so the guard must skip it too — hence the `is_active = 1` filter.
 */
export async function getActiveRoleDefaultProfile(role) {
  return db.execute({
    sql: `SELECT ap.id, ap.name
          FROM role_access_profile_defaults rpd
          JOIN access_profiles ap ON ap.id = rpd.access_profile_id
          WHERE rpd.role_name = ? AND ap.is_active = 1`,
    args: [role],
  });
}

/** Capability rows of a profile — the override/default layer of the base. */
export async function listProfileCapabilityRows(profileId) {
  return db.execute({
    sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?",
    args: [profileId],
  });
}

/** Legacy `role_capabilities` rows — the fallback when no profile resolves. */
export async function listRoleCapabilityRows(role) {
  return db.execute({
    sql: "SELECT module, capability, access_level FROM role_capabilities WHERE role = ?",
    args: [role],
  });
}
