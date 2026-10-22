import db from "@/lib/db";

/**
 * Base-capability reads (repository layer).
 *
 * A person's BASE capabilities are resolved by a precedence — an active profile
 * override wins, else the role's active default profile. There is no per-role
 * capability fallback anymore: the role names a default PROFILE, and that
 * profile is the only source. The statements below only feed that rule; the
 * rule itself lives in `@/services/authorization/baseCapabilities`.
 *
 * Statements are byte-identical to the ones they were lifted from
 * (`@/models/authorization`), so the API jest suites that match on SQL text keep
 * intercepting. One function per query, named after the data.
 */

/**
 * The contact's baseline identity plus any explicit profile override.
 * `profile_key` is what decides whether the override probe is run at all.
 */
export async function getContactBaseState(userCid) {
  return db.execute({
    sql: "SELECT role, profile_key FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

