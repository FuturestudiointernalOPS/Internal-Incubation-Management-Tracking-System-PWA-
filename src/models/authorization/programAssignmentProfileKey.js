/**
 * PROFILES TAKE OVER — per-assignment profile override, carried by a KEY.
 *
 * docs/PROFILES_TAKEOVER_MIGRATION.md. A program assignment (`v2_program_staff`)
 * could carry an optional `access_profile_id` (migration 041) that refined the
 * assignment's capability levels. With `access_profiles` retired, the override
 * is carried by a profile KEY instead.
 *
 * The one-time data move (legacy id → key) has been RETIRED: it read
 * `v2_program_staff.access_profile_id`, a column the takeover drop removed, so on
 * every database that had already completed the takeover it could only fail —
 * and, its marker never being written, it re-failed on every boot. The keys it
 * filled are in place. What remains here is the self-healing column and the
 * facilitator seed, kept for a database that still needs them.
 */

import db from "@/lib/db";

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

/**
 * Lot 3.4 / D-5 — every FACILITATOR assignment gets the facilitator PROFILE.
 *
 * Inert while the per-assignment checkboxes still have precedence: setting the
 * key changes no answer, it only removes the data gap that would make the
 * profile-based switch deny every facilitator.
 *
 * Runs under its own migration key, NULL-only, so an administrator's choice is
 * never overwritten.
 */
export async function backfillFacilitatorProfileKeys() {
  await ensureProgramAssignmentProfileKeySchema();
  const result = await db.execute({
    sql: `UPDATE v2_program_staff SET profile_key = 'facilitator'
          WHERE role = 'facilitator'
            AND (profile_key IS NULL OR profile_key = '')`,
    args: [],
  });
  return { success: true, updated: result?.rowsAffected ?? 0 };
}
