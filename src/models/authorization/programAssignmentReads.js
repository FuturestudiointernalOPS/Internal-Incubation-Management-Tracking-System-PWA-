/**
 * Authorization — program assignment reads (REPOSITORY layer).
 *
 * The data access behind the program-assignment derivation: the active
 * assignment rows for a person, the batch lookups the facilitator derivation
 * needs, and the tolerant read for the optional per-assignment profile column.
 * The derivation itself (which capabilities an assignment grants, and its
 * expiry) lives in `@/services/authorization/programAssignments`.
 *
 * SQL is byte-identical to what used to sit inline in `programAssignments.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per query, no
 * decisions. `isProgramEnded` is a pure predicate kept here because the read
 * below uses it to drop ended rows — it is a shared helper, not a policy.
 */

import db from "@/lib/db";
import { parsePermissions } from "@/lib/facilitator-permissions";

/** Program statuses that mean "this program no longer runs". */
export const PROGRAM_ENDED_STATUSES = [
  "completed",
  "complete",
  "archived",
  "cancelled",
  "canceled",
  "closed",
];

/**
 * Pure: has this program ended? `today` is an ISO date (YYYY-MM-DD).
 * Fail-safe direction: an unknown/absent schedule does NOT end a program.
 */
export function isProgramEnded(
  { status, is_archived, end_date } = {},
  today = new Date().toISOString().slice(0, 10),
) {
  if (Number(is_archived) === 1) return true;
  const normalized = String(status || "").trim().toLowerCase();
  if (PROGRAM_ENDED_STATUSES.includes(normalized)) return true;
  if (end_date) {
    const end = String(end_date).slice(0, 10);
    if (end && end < today) return true;
  }
  return false;
}

// ─── Optional column: v2_program_staff.profile_key ──────────────────────────
//
// A per-assignment profile override is a REFINEMENT of the tick list (JSON
// overrides first, then the assignment's profile, then the program default). The
// column is added by the profiles-takeover migration
// (`programAssignmentProfileKey.js`), and until it exists a query that NAMES it
// fails on the whole statement — which took the assignment derivation down with
// it, and with it every gated request that waits on the migration batch.
//
// So the read is tolerant: try with the column, and if the column is what is
// missing, retry once without it and remember that for the process. The feature
// then works on a database that has not applied it (overrides simply inactive),
// and starts honouring them the moment the column exists — no deploy, no flag.
let assignmentProfileColumn = null; // null = unknown, true/false = known

/** Is this error "the column I named does not exist"? */
export function isMissingColumnError(error, column = "profile_key") {
  const message = String(error?.message || error || "").toLowerCase();
  if (!message.includes(String(column).toLowerCase())) return false;
  return (
    message.includes("does not exist") ||
    message.includes("no such column") ||
    message.includes("unknown column")
  );
}

/**
 * Run a query that may name the optional profile column, falling back to the
 * variant that does not. Returns the rows either way; only genuine failures
 * propagate. Exported so the tick-list backfill reads the same way.
 */
export async function executeWithOptionalProfileColumn({
  withColumn,
  withoutColumn,
  args,
}) {
  if (assignmentProfileColumn === false) {
    return db.execute({ sql: withoutColumn, args });
  }
  try {
    const res = await db.execute({ sql: withColumn, args });
    assignmentProfileColumn = true;
    return res;
  } catch (error) {
    if (assignmentProfileColumn === null && isMissingColumnError(error)) {
      assignmentProfileColumn = false;
      console.warn(
        "[Authz] v2_program_staff.profile_key is absent (profiles-takeover not applied): " +
          "per-assignment profile overrides are inactive until it exists; the tick list is unaffected.",
      );
      return db.execute({ sql: withoutColumn, args });
    }
    throw error;
  }
}

/** Test seam: forget what was learned about the column. */
export function resetAssignmentProfileColumnCache() {
  assignmentProfileColumn = null;
}

/**
 * Every ACTIVE program assignment for one person, with the program schedule the
 * derivation needs. Email-tolerant on `staff_id` (legacy rows hold an address).
 *
 * Fail-safe: a lookup error returns an EMPTY list and no expiry rather than a
 * partial one — an empty list withdraws context-derived grants, which is the
 * conservative direction for a mechanism that only ever adds access.
 */
export async function listActiveProgramAssignments(cid, { email = null } = {}) {
  if (!cid) return { rows: [], ended: false, error: null };
  try {
    const staffRes = await executeWithOptionalProfileColumn({
      withColumn: `SELECT CAST(ps.program_id AS TEXT) AS program_id,
                   LOWER(COALESCE(ps.role, '')) AS role_key,
                   ps.permissions AS permissions,
                   ps.profile_key AS profile_key,
                   p.end_date AS end_date,
                   p.status AS status,
                   p.is_archived AS is_archived
            FROM v2_program_staff ps
            LEFT JOIN v2_programs p
              ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
            WHERE (ps.staff_id = ? OR LOWER(TRIM(ps.staff_id)) = LOWER(?))`,
      // Same query, minus the optional column: the assignment still counts, it
      // simply carries no profile override.
      withoutColumn: `SELECT CAST(ps.program_id AS TEXT) AS program_id,
                   LOWER(COALESCE(ps.role, '')) AS role_key,
                   ps.permissions AS permissions,
                   NULL AS profile_key,
                   p.end_date AS end_date,
                   p.status AS status,
                   p.is_archived AS is_archived
            FROM v2_program_staff ps
            LEFT JOIN v2_programs p
              ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
            WHERE (ps.staff_id = ? OR LOWER(TRIM(ps.staff_id)) = LOWER(?))`,
      args: [String(cid), email || String(cid)],
    });

    const pmRes = await db.execute({
      sql: `SELECT CAST(p.id AS TEXT) AS program_id,
                   'program_manager' AS role_key,
                   NULL AS permissions,
                   NULL AS profile_key,
                   p.end_date AS end_date,
                   p.status AS status,
                   p.is_archived AS is_archived
            FROM v2_programs p
            WHERE CAST(p.assigned_pm_id AS TEXT) = ?`,
      args: [String(cid)],
    });

    const today = new Date().toISOString().slice(0, 10);
    const rows = [...(staffRes.rows || []), ...(pmRes.rows || [])].filter(
      (row) => !isProgramEnded(row, today),
    );
    return { rows, ended: true, error: null };
  } catch (error) {
    console.warn(
      `[Authz] listActiveProgramAssignments(${cid}) failed:`,
      error.message,
    );
    return { rows: [], ended: false, error: error.message };
  }
}

/**
 * Batch lookups the facilitator derivation needs, in two queries regardless of
 * how many programs the person is assigned to (the per-capability loop in
 * getFacilitatorPermissionLevel would otherwise cost one round trip per
 * capability per program).
 */
export async function loadAssignmentLookups(assignments = []) {
  const programIds = [...new Set(assignments.map((assignment) => String(assignment.program_id)))];
  const profileKeys = [
    ...new Set(
      assignments
        .map((assignment) => assignment.profile_key)
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

  const profileCapsByProfile = {};
  for (const row of profileRes.rows || []) {
    const profileKey = String(row.profile_key);
    profileCapsByProfile[profileKey] ??= [];
    profileCapsByProfile[profileKey].push(row);
  }

  const profileCapsByAssignment = {};
  for (const assignment of assignments) {
    const profileKey = assignment.profile_key;
    if (profileKey === null || profileKey === undefined || profileKey === "") continue;
    profileCapsByAssignment[String(assignment.program_id)] =
      profileCapsByProfile[String(profileKey)] || [];
  }

  return { programDefaultById, profileCapsByAssignment };
}

/**
 * Every person who currently holds (or previously held) a program assignment,
 * for the reconcile sweep. Duplicate cids are collapsed.
 */
export async function listProgramAssignmentContacts() {
  const [staffRes, pmRes] = await Promise.all([
    db.execute({
      sql: `SELECT DISTINCT staff_id AS cid FROM v2_program_staff
            WHERE staff_id IS NOT NULL AND TRIM(staff_id) <> ''`,
    }),
    db.execute({
      sql: `SELECT DISTINCT CAST(assigned_pm_id AS TEXT) AS cid
            FROM v2_programs
            WHERE assigned_pm_id IS NOT NULL AND TRIM(CAST(assigned_pm_id AS TEXT)) <> ''`,
    }),
  ]);
  const cids = new Set();
  for (const row of [...(staffRes.rows || []), ...(pmRes.rows || [])]) {
    if (row.cid) cids.add(String(row.cid));
  }
  return [...cids];
}
