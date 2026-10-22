import db from "@/lib/db";

// ── GET/POST/PUT /api/ventures ───────────────────────────────────────────────

/**
 * Ventures list with founder/member counts and optional directory filters.
 *
 * A DELETED Venture is not a project. `is_archived` is this schema's soft-delete
 * marker for a Venture and `status = 'archived'` is the same fact written the
 * other way; either one means the Venture must not be offered as active work.
 * Both are excluded unless the caller explicitly asks for them
 * (`includeArchived`, i.e. the history/archived views).
 *
 * `is_archived::int` IS NOT DECORATION. On `ventures` this column is an INTEGER
 * (a legacy generation of the DDL), while the work tables' same-named column is
 * a BOOLEAN. `COALESCE(v.is_archived, FALSE) = FALSE` therefore does not merely
 * mis-filter — PostgreSQL refuses to plan it at all ("COALESCE types integer
 * and boolean cannot be matched"), which takes the whole Venture list down. The
 * cast to int is what makes the predicate work for either column type, and it is
 * verified against the live schema, not assumed.
 */
export async function listVenturesWithCounts({ effectiveContactId, assignedStaffId, status, search, includeArchived = false }) {
  let sql = `
      SELECT v.*,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id::text = v.id::text AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id::text = v.id::text AND vm.member_type != 'founder' AND vm.removed_at IS NULL) as member_count
      FROM ventures v WHERE 1=1
    `;
  const args = [];

  if (!includeArchived) {
    sql += " AND COALESCE(v.is_archived::int, 0) = 0 AND COALESCE(LOWER(v.status), '') <> 'archived'";
  }

  if (effectiveContactId) {
    sql += " AND v.id::text IN (SELECT vm.venture_id::text FROM venture_members vm WHERE vm.user_cid = ? OR vm.contact_id = ?)";
    args.push(effectiveContactId, effectiveContactId);
  }

  // Delegated staff/program_manager: assigned Ventures OR Ventures they are a
  // member of — never the whole directory. Membership/assignment columns hold
  // the internal id, so the comparison is on `v.id`.
  if (assignedStaffId) {
    sql += " AND (v.id::text IN (SELECT venture_id::text FROM venture_staff_assignments WHERE staff_contact_id = ? AND status = 'active') OR v.id::text IN (SELECT vm.venture_id::text FROM venture_members vm WHERE vm.user_cid = ? OR vm.contact_id = ?))";
    args.push(assignedStaffId, assignedStaffId, assignedStaffId);
  }

  if (status) {
    sql += " AND v.status = ?";
    args.push(status);
  }

  if (search) {
    sql += " AND (LOWER(v.name) LIKE ? OR LOWER(v.venture_id) LIKE ? OR LOWER(v.industry) LIKE ?)";
    const searchPattern = `%${search.toLowerCase()}%`;
    args.push(searchPattern, searchPattern, searchPattern);
  }

  sql += " ORDER BY v.created_at DESC";

  return db.execute({ sql, args });
}

/** contact_timeline 'venture_updated' event after a PUT update. */
export async function recordVentureUpdatedTimeline({ contact_cid, venture_id, updated_fields }) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                  VALUES (?, 'venture_updated', ?, 'ventures', ?, ?, ?::jsonb)`,
    args: [contact_cid, `Updated venture ${venture_id}`, venture_id, contact_cid, JSON.stringify({ updated_fields })],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/members ────────────────────────────────

// ── GET /api/ventures/[id]/dashboard ─────────────────────────────────────────

// ── GET /api/ventures/[id]/progress ──────────────────────────────────────────

/** Internal ventures.id by VNT code — progress resolveVentureDbId helper. */
export async function getVentureDbIdForProgress(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Average milestone progress for a venture (archived milestones excluded). */
export async function getAverageVentureMilestoneProgress(dbId) {
  return db.execute({
    sql: "SELECT AVG(progress) as avg_progress FROM venture_milestones WHERE venture_id = ? AND COALESCE(is_archived, FALSE) = FALSE",
    args: [dbId],
  });
}

/**
 * Milestones COMPLETED — the count the dashboard shows instead of the average
 * of a stored `progress` column that is only written when a deliverable is
 * reviewed (so a milestone closed through its tasks kept reading 0).
 */
export async function countVentureMilestonesByStatus(dbId) {
  return db.execute({
    sql: `SELECT COUNT(*) AS total,
                 SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS done
            FROM venture_milestones
           WHERE venture_id = ? AND COALESCE(is_archived, FALSE) = FALSE`,
    args: [dbId],
  });
}

/** Standup count for a venture (progress widget). */
export async function countVentureStandupsByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_standups WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Retro count for a venture (progress widget). */
export async function countVentureRetrosByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_retros WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Profile-score fields of a venture by internal id. */
export async function getVentureProfileFields(dbId) {
  return db.execute({
    sql: "SELECT name, description, mission, vision, industry, sector, business_stage, website FROM ventures WHERE id = ?",
    args: [dbId],
  });
}

/**
 * Active founder count for a Venture.
 *
 * The membership table keys on the INTERNAL id (`uuid` in the current schema),
 * while the progress screen also holds the readable VNT code. Comparing the code
 * straight to that column raised “operator does not exist: uuid = text” (or an
 * invalid-uuid error), which took the whole progress read down and left Venture
 * Setup at « — ». The text cast works for either generation of the column, and
 * both references are accepted so a legacy code-keyed row still counts.
 */
export async function countVentureFoundersForVenture(ventureRef, dbId) {
  return db.execute({
    sql: `SELECT COUNT(*) as count
            FROM venture_members
           WHERE venture_id::text IN (?, ?)
             AND member_type = 'founder'
             AND removed_at IS NULL`,
    args: [String(dbId || ""), String(ventureRef || "")],
  });
}

/** Non-deleted document count for a venture (progress widget). */
export async function countVentureDocumentsByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_documents WHERE venture_id = ? AND is_deleted = false",
    args: [dbId],
  });
}

/** Business-model existence row for a venture (progress widget). */
export async function getFirstVentureBusinessModelId(dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_business_models WHERE venture_id = ? LIMIT 1",
    args: [dbId],
  });
}

/** Customer interview count for a venture (progress widget). */
export async function countVentureCustomerInterviews(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_customer_interviews WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Validation count for a venture (progress widget). */
export async function countVentureValidations(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_validations WHERE venture_id = ?",
    args: [dbId],
  });
}

/** PMF assessment count for a venture (progress widget). */
export async function countVenturePmfAssessments(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_pmf_assessments WHERE venture_id = ?",
    args: [dbId],
  });
}
