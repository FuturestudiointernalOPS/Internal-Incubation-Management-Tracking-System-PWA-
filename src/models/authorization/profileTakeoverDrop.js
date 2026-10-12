/**
 * PROFILES TAKE OVER — the retired access-profile tables are dropped (final step).
 *
 * docs/PROFILES_TAKEOVER_MIGRATION.md. Every live surface (resolver, screens,
 * APIs, capability grants) now reads the `profiles` catalogue by key; the
 * template layer (`access_profiles` + its capabilities + the role defaults) is
 * dead. This one-time migration removes it, and the two legacy override columns
 * that pointed at it.
 *
 * Idempotent (`IF EXISTS`): re-running on an already-clean database is a no-op.
 * Destructive by design — it is the last step of the takeover, after the data
 * has been moved and every reader switched.
 */

import db from "@/lib/db";

export async function dropAccessProfileTables() {
  // The two override columns first: they point at profiles now (profile_key).
  await db.execute("ALTER TABLE contacts DROP COLUMN IF EXISTS access_profile_id");
  await db.execute("ALTER TABLE v2_program_staff DROP COLUMN IF EXISTS access_profile_id");

  // Then the template layer itself.
  await db.execute("DROP TABLE IF EXISTS role_access_profile_defaults");
  await db.execute("DROP TABLE IF EXISTS access_profile_capabilities");
  await db.execute("DROP TABLE IF EXISTS access_profiles");

  return { success: true };
}
