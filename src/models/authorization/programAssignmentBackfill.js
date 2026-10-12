/**
 * ImpactOS — ASSIGNMENT-DERIVED PROGRAM ACCESS: ONE-TIME BACKFILL
 *
 * `backfillFacilitatorTickLists` fills the MISSING entries of every facilitator
 * assignment's tick list.
 *
 * WHY: the per-program tick list is read with "no entry ⇒ no narrowing" (see
 * `resolveAssignmentCapabilityLevel`). The moment the remaining facilitator
 * actions start consulting the tick list, an absent entry would resolve to
 * zero and DENY access that the facilitator has today. Writing the entry that
 * today's resolution already produces changes nobody's access — it only makes
 * today's reality explicit, so the enforcement step cannot strand a facilitator
 * who was already working.
 *
 * Insert-only in effect: an entry that already exists is never rewritten. It
 * records its own migration name, so an administrator's later edits are never
 * re-applied over.
 */

import db from "@/lib/db";
import { ensurePermissionsSchema } from "@/models/authorization/bootstrap";
import {
  FACILITATOR_CAPABILITY_KEYS,
  parsePermissions,
} from "@/lib/facilitator-permissions";
import { executeWithOptionalProfileColumn } from "./programAssignmentReads";
// The level resolution is a decision; it lives in the service layer.
import { resolveAssignmentCapabilityLevel } from "@/services/authorization/programAssignments";

/**
 * Fill the missing facilitator tick-list entries at the level today's
 * resolution already produces. Never rewrites an existing entry, so an
 * administrator's explicit 0 stays a 0 (which is what makes a per-program
 * removal meaningful once enforcement reads it).
 */
export async function backfillFacilitatorTickLists() {
  await ensurePermissionsSchema();
  // The profile-override column is optional here too: the tick list is what this
  // backfill exists for, and it must not be blocked by a column that only refines
  // the level lookup (see executeWithOptionalProfileColumn).
  const rowRes = await executeWithOptionalProfileColumn({
    withColumn: `SELECT id, CAST(program_id AS TEXT) AS program_id, permissions, profile_key
          FROM v2_program_staff
          WHERE LOWER(COALESCE(role, '')) = 'facilitator'`,
    withoutColumn: `SELECT id, CAST(program_id AS TEXT) AS program_id, permissions, NULL AS profile_key
          FROM v2_program_staff
          WHERE LOWER(COALESCE(role, '')) = 'facilitator'`,
    args: [],
  });
  const rows = rowRes.rows || [];
  if (rows.length === 0) return { success: true, updated: 0, scanned: 0 };

  const programIds = [...new Set(rows.map((row) => String(row.program_id)))].filter(
    Boolean,
  );
  const profileKeys = [
    ...new Set(
      rows
        .map((row) => row.profile_key)
        .filter((key) => key !== null && key !== undefined && key !== ""),
    ),
  ];

  const [defaultsRes, profileRes] = await Promise.all([
    programIds.length
      ? db.execute({
          sql: `SELECT CAST(id AS TEXT) AS id, facilitator_default_permissions AS def
                FROM v2_programs
                WHERE CAST(id AS TEXT) IN (${programIds.map(() => "?").join(",")})`,
          args: programIds,
        })
      : Promise.resolve({ rows: [] }),
    profileKeys.length
      ? db.execute({
          sql: `SELECT profile_key, module, capability, access_level
                FROM profile_capabilities
                WHERE profile_key IN (${profileKeys.map(() => "?").join(",")})`,
          args: profileKeys,
        })
      : Promise.resolve({ rows: [] }),
  ]);

  const programDefaultById = {};
  for (const row of defaultsRes.rows || []) {
    programDefaultById[String(row.id)] = parsePermissions(row.def);
  }
  const profileCapsByKey = {};
  for (const row of profileRes.rows || []) {
    const profileKey = String(row.profile_key);
    profileCapsByKey[profileKey] ??= [];
    profileCapsByKey[profileKey].push(row);
  }

  let updated = 0;
  for (const row of rows) {
    const current = parsePermissions(row.permissions);
    const missing = FACILITATOR_CAPABILITY_KEYS.filter(
      (capability) => typeof current[capability] !== "number",
    );
    if (missing.length === 0) continue;

    const ctx = {
      profileCaps:
        row.profile_key != null
          ? profileCapsByKey[String(row.profile_key)] || []
          : [],
      programDefault: programDefaultById[String(row.program_id)] || {},
    };
    const next = { ...current };
    for (const capability of missing) {
      next[capability] = Number(
        resolveAssignmentCapabilityLevel(row, capability, ctx),
      );
    }

    await db.execute({
      sql: "UPDATE v2_program_staff SET permissions = ? WHERE id = ?",
      args: [JSON.stringify(next), row.id],
    });
    updated++;
  }

  return { success: true, updated, scanned: rows.length };
}
