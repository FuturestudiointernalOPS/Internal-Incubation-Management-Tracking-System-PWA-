import db from "@/lib/db";

/**
 * Contact directory store — the listing reads (super admin / staff / scoped),
 * the pool narrowers and the name/email searches.
 *
 * Split out of `src/models/contacts.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/contacts` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET /api/contacts ─────────────────────────────────────────────────────────

/** Directory for super admins: optional role/status/group filters. */
export async function getContactsForSuperAdmin(roleFilter, statusFilter, groupFilter) {
  let sql = "SELECT * FROM contacts WHERE archived_at IS NULL AND deleted_at IS NULL";
  const args = [];
  if (roleFilter) {
    const roles = roleFilter.split(",");
    sql += " AND (" + roles.map(() => "role = ?").join(" OR ") + ")";
    args.push(...roles);
  }
  if (statusFilter && statusFilter !== "all") {
    sql += " AND status = ?";
    args.push(statusFilter);
  }
  if (groupFilter) {
    sql += " AND UPPER(TRIM(group_name)) = UPPER(TRIM(?))";
    args.push(groupFilter);
  }
  sql += " ORDER BY name ASC";
  return db.execute({ sql, args });
}

/** Directory for staff (active only; PMs also see pending). */
export async function getContactsForStaff(role, groupFilter) {
  const statusClause =
    role === "program_manager" ? "status IN ('active', 'pending')" : "status = 'active'";
  let sql =
    `SELECT * FROM contacts WHERE archived_at IS NULL AND deleted_at IS NULL AND ${statusClause}`;
  const args = [];
  if (groupFilter) {
    sql += " AND UPPER(TRIM(group_name)) = UPPER(TRIM(?))";
    args.push(groupFilter);
  }
  sql += " ORDER BY name ASC";
  return db.execute({ sql, args });
}

/** Distinct program-enrolled participant cids from a cid pool. */
export async function getParticipantProgramCids(cids) {
  const placeholders = cids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT DISTINCT participant_id FROM participant_programs WHERE participant_id IN (${placeholders})`,
    args: cids,
  });
}

/** Distinct cids holding a current role assignment, from a cid pool. */
export async function getContactRoleAssignmentCids(cids) {
  const placeholders = cids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT DISTINCT contact_cid FROM contact_roles WHERE contact_cid IN (${placeholders}) AND is_current = true`,
    args: cids,
  });
}

// ── GET /api/contacts/full-state ──────────────────────────────────────────────

/** Programs assigned to a program manager (id + name). */
export async function getPmAssignedPrograms(pmId) {
  return db.execute({
    sql: "SELECT id, name FROM v2_programs WHERE assigned_pm_id = ?",
    args: [pmId],
  });
}

/** Contacts belonging to the PM's programs and/or groups. */
export async function getContactsScopedByProgramsAndGroups(
  programIds,
  programNames,
  statusFilter,
) {
  const idPlaceholders = programIds.map(() => "?").join(",") || "NULL";
  const namePlaceholders = programNames.map(() => "?").join(",") || "NULL";

  const archiveClause =
    statusFilter === "archived" ? "AND archived_at IS NOT NULL" : "AND archived_at IS NULL";

  return db.execute({
    sql: `SELECT * FROM contacts
                WHERE (cid IN (
                        SELECT participant_id FROM participant_programs
                        WHERE CAST(program_id AS TEXT) IN (${idPlaceholders})
                      )
                OR UPPER(TRIM(group_name)) IN (${namePlaceholders}))
                AND deleted_at IS NULL
                ${archiveClause}
                ORDER BY created_at DESC`,
    args: [...programIds, ...programNames],
  });
}

/** Authoritative program participants via participant_programs joins. */
export async function getEnrolledProgramParticipants(programIds) {
  const idPlaceholders = programIds.map(() => "?").join(",") || "NULL";
  return db.execute({
    sql: `SELECT c.*
                  FROM participant_programs pp
                  JOIN contacts c ON pp.participant_id = c.cid
                  WHERE CAST(pp.program_id AS TEXT) IN (${idPlaceholders})
                    AND c.deleted = 0
                    AND c.deleted_at IS NULL`,
    args: [...programIds],
  });
}

/** Teams belonging to the PM's programs. */
export async function getTeamsScopedByPrograms(programIds) {
  const idPlaceholders = programIds.map(() => "?").join(",") || "NULL";
  return db.execute({
    sql: `SELECT id, name, group_name, program_id FROM v2_teams
                WHERE program_id IN (${idPlaceholders})`,
    args: [...programIds],
  });
}

// ── GET /api/contacts/search ──────────────────────────────────────────────────

/** Program-scoped name/email search for external (participant/founder) users. */
export async function searchContactsInProgram(like, programId) {
  return db.execute({
    sql: `SELECT cid, name, email FROM contacts
              WHERE (name ILIKE ? OR email ILIKE ?)
                AND (
                  cid IN (
                    SELECT participant_id FROM participant_programs
                    WHERE CAST(program_id AS TEXT) = ?
                  )
                  OR cid IN (
                    SELECT staff_id FROM v2_program_staff
                    WHERE CAST(program_id AS TEXT) = ?
                  )
                  OR cid IN (
                    SELECT assigned_pm_id FROM v2_programs
                    WHERE id::text = ? AND assigned_pm_id IS NOT NULL
                  )
                )
              ORDER BY name ASC LIMIT 20`,
    args: [like, like, programId, programId, programId],
  });
}

/**
 * General directory name/email search for internal CRM roles. `role` is
 * included so callers (e.g. the Venture Staff picker) can distinguish Future
 * Studio staff from founders/participants in the results.
 */
export async function searchContactsByNameOrEmail(like) {
  return db.execute({
    sql: `SELECT cid, name, email, role FROM contacts
            WHERE (name ILIKE ? OR email ILIKE ?)
            ORDER BY name ASC LIMIT 20`,
    args: [like, like],
  });
}
