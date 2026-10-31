import db from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// /api/pm/programs — operational-intelligence list, full lifecycle (29 queries)
// ─────────────────────────────────────────────────────────────────────────────

/** Auto-activate planned programs whose start_date has passed. Used by GET. */
export async function autoActivatePlannedPrograms() {
  return db.execute({
    sql: "UPDATE v2_programs SET status = 'Active' WHERE status = 'Planned' AND start_date IS NOT NULL AND start_date <= CURRENT_DATE",
    args: [],
  });
}

/**
 * Basic program list scoped by archive/status filters, assigned-PM/assistant
 * membership and (for facilitators) program-staff assignment. Filter assembly
 * mirrors the original controller logic, so the executed SQL is byte-identical.
 * Used by GET /api/pm/programs.
 */
export async function listProgramsByManagementFilters({
  showAll,
  showArchived,
  status,
  assignedPmId,
  session,
}) {
  const args = [];

  // 1. Fetch Basic Programs
  let baseQuery = `
      SELECT p.*,
             c1.name as pm_name,
             c2.name as assistant_name,
             k.title as note_title
      FROM v2_programs p
      LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
      LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
      LEFT JOIN v2_knowledge_bank k ON CAST(p.note_id AS TEXT) = CAST(k.id AS TEXT)
    `;

  if (showAll) {
    // No archive filter — show everything
    baseQuery += " WHERE 1=1";
  } else {
    const archiveVal = showArchived ? 1 : 0;
    args.push(archiveVal, archiveVal);
    baseQuery +=
      " WHERE (p.is_archived = ? OR (p.is_archived IS NULL AND ? = 0))";
  }

  if (status && status.toLowerCase() !== "all") {
    if (status.toLowerCase() === "active") {
      baseQuery += " AND (p.status ILIKE ? OR p.status IS NULL)";
    } else {
      baseQuery += " AND p.status ILIKE ?";
    }
    args.push(status);
  }
  if (assignedPmId) {
    baseQuery +=
      " AND (" +
      "p.assigned_pm_id = ?" +
      " OR p.assigned_assistant_id LIKE ?" +
      " OR p.id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?)" +
      " OR p.id IN (SELECT program_id FROM v2_program_staff WHERE role = 'program_manager' AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)))" +
      " OR p.id::text IN (SELECT context_id FROM contact_roles WHERE role = 'program_manager' AND context_type = 'program' AND is_current = true AND contact_cid = ?)" +
      ")";
    args.push(
      assignedPmId,
      `%${assignedPmId}%`,
      assignedPmId,
      session.cid,
      session.email || "",
      session.cid,
    );
  }
  // Phase I6B (membership-keyed): every non-management, non-staff session is
  // scoped to the programs it is assigned to (matched by cid or email so
  // legacy rows that stored the email still resolve correctly). Management
  // roles and staff stay unscoped. This admits a baseline Member who holds a
  // facilitator assignment, and returns an empty list for everyone else.
  if (
    session?.role &&
    !["super_admin", "program_manager", "staff"].includes(session.role)
  ) {
    baseQuery +=
      " AND p.id IN (SELECT program_id FROM v2_program_staff WHERE (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)) AND role = 'facilitator')";
    args.push(session.cid, session.email || "");
  }
  baseQuery += " ORDER BY p.created_at DESC";

  return db.execute({ sql: baseQuery, args });
}
