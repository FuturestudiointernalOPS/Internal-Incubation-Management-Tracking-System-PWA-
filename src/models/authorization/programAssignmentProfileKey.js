/**
 * PROFILES TAKE OVER — per-assignment profile override, moved to a KEY.
 *
 * docs/PROFILES_TAKEOVER_MIGRATION.md. A program assignment (`v2_program_staff`)
 * could carry an optional `access_profile_id` (migration 041) that refined the
 * assignment's capability levels. With `access_profiles` retired, the override
 * is carried by a profile KEY instead.
 *
 * One-time and idempotent:
 *   • adds `v2_program_staff.profile_key` (self-healing, fail-soft);
 *   • fills it from the legacy `access_profile_id` through the takeover map
 *     (NULL-only, administrator edits win; a dangling id leaves NULL).
 *
 * Runs before the `access_profiles` drop. On a database where the legacy table
 * is already gone, the backfill has nothing to move and reports that honestly
 * instead of failing.
 */

import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import { profileKeyForAccessProfileName } from "./profileTakeoverBackfill";

let programAssignmentProfileKeyPromise = null;

/** Idempotent runtime self-healing for the new column (no migration runner). */
export function ensureProgramAssignmentProfileKeySchema() {
  if (!programAssignmentProfileKeyPromise) {
    programAssignmentProfileKeyPromise = (async () => {
      await db.execute(
        `ALTER TABLE v2_program_staff ADD COLUMN IF NOT EXISTS profile_key TEXT`,
      );
      return true;
    })().catch((error) => {
      console.warn(
        "[Authz] ensureProgramAssignmentProfileKeySchema failed:",
        error.message,
      );
      programAssignmentProfileKeyPromise = null;
      return false;
    });
  }
  return programAssignmentProfileKeyPromise;
}

/** One-time, idempotent, NULL-only. Never throws on a soft failure. */
export async function backfillProgramAssignmentProfileKeys() {
  await ensurePermissionsSchema();
  await ensureProgramAssignmentProfileKeySchema();

  let accessProfiles;
  try {
    accessProfiles = await db.execute({
      sql: "SELECT id, name FROM access_profiles",
      args: [],
    });
  } catch (error) {
    // The legacy table is already gone (this ran before the drop, or a fresh
    // database never had one) — nothing to move.
    return { success: true, skipped: true, reason: error.message, updated: 0 };
  }

  let updated = 0;
  for (const row of accessProfiles.rows || []) {
    const key = profileKeyForAccessProfileName(row.name);
    if (!key) continue;
    const res = await db.execute({
      sql: `UPDATE v2_program_staff SET profile_key = ?
            WHERE access_profile_id = ? AND profile_key IS NULL`,
      args: [key, Number(row.id)],
    });
    updated += res?.rowsAffected ?? 0;
  }
  return { success: true, updated };
}
