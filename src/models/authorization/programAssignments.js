/**
 * ImpactOS — PROGRAM ASSIGNMENT → CAPABILITY DERIVATION
 *
 * A PROGRAM FACILITATOR and a PROGRAM MANAGER are CONTEXTUAL ROLES, not global
 * identities. Their program access must come from the assignment they hold on a
 * particular program — and only for as long as that program runs:
 *
 *   v2_program_staff (role = facilitator)   ─┐
 *   v2_programs.assigned_pm_id              ─┤→ active assignment rows
 *   v2_program_staff (role = program_manager)┘
 *          │
 *          ├─ FACILITATOR: the per-assignment tick levels decide WHICH
 *          │  capabilities the assignment really grants (JSON override →
 *          │  assignment profile → program default → unconfigured = granted),
 *          │  unioned across every program the person is assigned to.
 *          │
 *          └─ PROGRAM MANAGER: the Context Roles registry decides which
 *             profile's capabilities the assignment seeds.
 *          │
 *          └─ EXPIRY: the latest program end date. Past it the grant is dead
 *             (the resolver already ignores expired grants), so program access
 *             ends with the program even if no sweep ever runs.
 *
 * WHY "unconfigured = granted": before this model, a facilitator capability
 * absent from the stored tick list was never consulted at all — the person was
 * allowed. Reading an absent key as DENIED would therefore strip access from
 * every facilitator already in production. The derivation mirrors the live
 * resolution order exactly, with the live default as its last step, so the
 * applied grant can never disagree with what the person actually has.
 *
 * SQL lives here (MVC: models only). No HTTP imports.
 */

import db from "@/lib/db";
import {
  FACILITATOR_CAPABILITY_KEYS,
  parsePermissions,
} from "@/lib/facilitator-permissions";

/** Program statuses that mean "this program no longer runs". */
export const PROGRAM_ENDED_STATUSES = [
  "completed",
  "complete",
  "archived",
  "cancelled",
  "canceled",
  "closed",
];

/** Unconfigured means granted (see the module header). */
export const UNCONFIGURED_LEVEL = 1;

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

/** ISO date (YYYY-MM-DD) for a possibly-Date/possibly-string db value. */
function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * The capability level an ASSIGNMENT grants for one capability — mirrors
 * getFacilitatorPermissionLevel() in src/lib/auth.js step for step, adding the
 * live "unconfigured" default as the final step.
 *
 * @param {Object} assignment  { permissions, access_profile_id, program_id }
 * @param {Object} ctx         { profileCaps: Array<{module,capability,access_level}>,
 *                               programDefault: Object }
 */
export function resolveAssignmentCapabilityLevel(assignment, capability, ctx = {}) {
  const override = parsePermissions(assignment?.permissions);
  if (typeof override[capability] === "number") return override[capability];

  for (const row of ctx.profileCaps || []) {
    const dotKey = `${row.module}.${row.capability}`;
    if (dotKey === capability || row.capability === capability) {
      return Number(row.access_level) || 0;
    }
  }

  const programDefault = ctx.programDefault || {};
  if (typeof programDefault[capability] === "number") {
    return programDefault[capability];
  }

  // Nothing configured anywhere → this is what today's behaviour amounts to.
  return UNCONFIGURED_LEVEL;
}

/**
 * Pure: union of the facilitator capabilities a person's assignments grant,
 * each at the STRONGEST level across their programs (a capability held in any
 * program is held; the program-level tick narrows WHERE it applies).
 *
 * @returns {{ desired: Object, programs: string[] }}
 */
export function deriveFacilitatorDesiredCaps(assignments = [], lookups = {}) {
  const desired = {};
  const programs = [];
  for (const a of assignments) {
    const programId = String(a?.program_id ?? "");
    if (!programId) continue;
    if (!programs.includes(programId)) programs.push(programId);
    const ctx = {
      profileCaps: lookups.profileCapsByAssignment?.[programId] || null,
      programDefault: lookups.programDefaultById?.[programId] || null,
    };
    for (const capability of FACILITATOR_CAPABILITY_KEYS) {
      const level = Number(
        resolveAssignmentCapabilityLevel(a, capability, ctx),
      );
      if (!(level >= 1)) continue; // an explicit 0 is a deliberate removal
      const key = `facilitator.${capability}`;
      if (!desired[key] || level > desired[key].level) {
        desired[key] = { module: "facilitator", capability, level };
      }
    }
  }
  return { desired, programs };
}

/**
 * Pure: the expiry for a set of assignments — the LATEST program end date, so
 * the grant survives until the last program the person works on finishes.
 * Returns null (no expiry) when any active assignment has no end date, because
 * access cannot be bounded by a date that does not exist.
 */
export function deriveAssignmentsExpiry(assignments = []) {
  let latest = null;
  for (const a of assignments) {
    const end = toIsoDate(a?.end_date);
    if (!end) return null;
    if (!latest || end > latest) latest = end;
  }
  return latest;
}

// ─── Optional column: v2_program_staff.access_profile_id ────────────────────
//
// A per-assignment access-profile override is a REFINEMENT of the tick list
// (JSON overrides first, then the assignment's profile, then the program
// default). The column arrives with migration 041, and until it is applied a
// query that NAMES it fails on the whole statement — which took the assignment
// derivation down with it, and with it every gated request that waits on the
// migration batch.
//
// So the read is tolerant: try with the column, and if the column is what is
// missing, retry once without it and remember that for the process. The feature
// then works on a database that has not applied 041 (overrides simply inactive),
// and starts honouring them the moment the column exists — no deploy, no flag.
let assignmentProfileColumn = null; // null = unknown, true/false = known

/** Is this error "the column I named does not exist"? */
export function isMissingColumnError(error, column = "access_profile_id") {
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
  } catch (e) {
    if (assignmentProfileColumn === null && isMissingColumnError(e)) {
      assignmentProfileColumn = false;
      console.warn(
        "[Authz] v2_program_staff.access_profile_id is absent (migration 041 not applied): " +
          "per-assignment profile overrides are inactive until it exists; the tick list is unaffected.",
      );
      return db.execute({ sql: withoutColumn, args });
    }
    throw e;
  }
}

/** Test seam: forget what was learned about the column. */
export function resetAssignmentProfileColumnCache() {
  assignmentProfileColumn = null;
}

/** Program ids where the person is the named manager. */
export async function listManagedProgramIds(cid) {
  if (!cid) return [];
  const r = await db.execute({
    sql: `SELECT CAST(id AS TEXT) AS program_id
          FROM v2_programs
          WHERE CAST(assigned_pm_id AS TEXT) = ?`,
    args: [String(cid)],
  });
  return (r.rows || []).map((row) => String(row.program_id)).filter(Boolean);
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
                   ps.access_profile_id AS access_profile_id,
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
                   NULL AS access_profile_id,
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
                   NULL AS access_profile_id,
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
  } catch (e) {
    console.warn(
      `[Authz] listActiveProgramAssignments(${cid}) failed:`,
      e.message,
    );
    return { rows: [], ended: false, error: e.message };
  }
}

/** Assignment rows for one role inside the program context. */
export function assignmentsForRole(rows = [], roleKey) {
  return rows.filter((row) => String(row.role_key || "") === roleKey);
}

/**
 * Batch lookups the facilitator derivation needs, in two queries regardless of
 * how many programs the person is assigned to (the per-capability loop in
 * getFacilitatorPermissionLevel would otherwise cost one round trip per
 * capability per program).
 */
export async function loadAssignmentLookups(assignments = []) {
  const programIds = [...new Set(assignments.map((a) => String(a.program_id)))];
  const profileIds = [
    ...new Set(
      assignments
        .map((a) => a.access_profile_id)
        .filter((id) => id !== null && id !== undefined && id !== ""),
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
    profileIds.length
      ? db.execute({
          sql: `SELECT profile_id, module, capability, access_level
                FROM access_profile_capabilities
                WHERE profile_id IN (${profileIds.map(() => "?").join(",")})`,
          args: profileIds,
        })
      : Promise.resolve({ rows: [] }),
  ]);

  const programDefaultById = {};
  for (const row of defaultsRes.rows || []) {
    programDefaultById[String(row.id)] = parsePermissions(row.def);
  }

  const profileCapsByProfile = {};
  for (const row of profileRes.rows || []) {
    const id = String(row.profile_id);
    profileCapsByProfile[id] ??= [];
    profileCapsByProfile[id].push(row);
  }

  const profileCapsByAssignment = {};
  for (const a of assignments) {
    const id = a.access_profile_id;
    if (id === null || id === undefined || id === "") continue;
    profileCapsByAssignment[String(a.program_id)] =
      profileCapsByProfile[String(id)] || [];
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
