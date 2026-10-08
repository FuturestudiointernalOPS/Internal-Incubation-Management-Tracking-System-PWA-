import db from "@/lib/db";

// ── GET/POST /api/op-reports — operational reports ──────────────────────────

/**
 * Filtered op-report list. Non-super-admins are always scoped to their own
 * reports (the controller pre-checks 403s for cross-user requests); super
 * admins get the workspace/user filters applied.
 */
export async function listOpReports({
  isSuperAdmin,
  sessionCid,
  user_id,
  workspace,
  report_type,
  week_number,
  year,
  context_type,
  context_id,
}) {
  let sql = "SELECT * FROM v2_op_reports WHERE 1=1";
  const args = [];

  // SECURITY (Phase 0): Non-SA users can only view their own reports.
  // SA can view all reports with optional filters.
  if (!isSuperAdmin) {
    sql += " AND user_id = ?";
    args.push(String(sessionCid));
  } else {
    // Super admin overview defaults to main workspace unless specified
    if (!user_id && !workspace) {
      sql += " AND workspace = 'main'";
    } else if (workspace) {
      sql += " AND workspace = ?";
      args.push(workspace);
    }

    // SA can filter by specific user
    if (user_id) {
      sql += " AND user_id = ?";
      args.push(user_id);
    }
  }

  if (report_type) {
    sql += " AND report_type = ?";
    args.push(report_type);
  }

  if (week_number) {
    sql += " AND week_number = ?";
    args.push(parseInt(week_number));
  }

  if (year) {
    sql += " AND year = ?";
    args.push(parseInt(year));
  }

  if (context_type) {
    sql += " AND context_type = ?";
    args.push(context_type);
  }

  if (context_id) {
    sql += " AND context_id = ?";
    args.push(context_id);
  }

  sql += " ORDER BY year DESC, week_number DESC, created_at DESC";

  return db.execute({ sql, args });
}

/** Existing report id for the user/week/year/type upsert check. */
export async function getOpReportId(userId, weekNumber, year, reportType) {
  return db.execute({
    sql: "SELECT id FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = ?",
    args: [userId, weekNumber, year, reportType],
  });
}

/**
 * Update an existing report. `updateFields` holds "col = ?" fragments plus the
 * final "updated_at = CURRENT_TIMESTAMP"; `updateArgs` ends with the report id.
 */
export async function updateOpReport(updateFields, updateArgs) {
  return db.execute({
    sql: `UPDATE v2_op_reports SET ${updateFields.join(", ")} WHERE id = ?`,
    args: updateArgs,
  });
}

/** Create a new op-report row and return its id. */
export async function insertOpReport({
  user_id,
  user_name,
  user_role,
  workspace,
  report_type,
  week_number,
  year,
  status,
  // Stand-up fields
  weekly_priorities,
  key_deliverables,
  risks_blockers,
  additional_notes,
  // New structured stand-up fields
  top_priorities,
  expected_deliverables,
  projects_tasks,
  has_dependencies,
  dependency_note,
  has_blockers,
  blocker_description,
  needs_support,
  support_note,
  // Retro fields
  completed_work,
  unfinished_tasks,
  challenges,
  wins,
  carryover_items,
  retro_notes,
  // Context fields
  context_type,
  context_id,
}) {
  return db.execute({
    sql: `INSERT INTO v2_op_reports
        (user_id, user_name, user_role, workspace, report_type, week_number, year, status,
         weekly_priorities, key_deliverables, risks_blockers, additional_notes,
         top_priorities, expected_deliverables, projects_tasks,
         has_dependencies, dependency_note, has_blockers, blocker_description,
         needs_support, support_note,
         completed_work, unfinished_tasks, challenges, wins, carryover_items, retro_notes,
         context_type, context_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?) RETURNING id`,
    args: [
      user_id,
      user_name || "",
      user_role || "staff",
      workspace,
      report_type,
      week_number,
      year,
      status || "draft",
      weekly_priorities || null,
      key_deliverables || null,
      risks_blockers || null,
      additional_notes || null,
      top_priorities || null,
      expected_deliverables || null,
      projects_tasks || null,
      has_dependencies != null ? (has_dependencies ? 1 : 0) : null,
      dependency_note || null,
      has_blockers != null ? (has_blockers ? 1 : 0) : null,
      blocker_description || null,
      needs_support != null ? (needs_support ? 1 : 0) : null,
      support_note || null,
      completed_work || null,
      unfinished_tasks || null,
      challenges || null,
      wins || null,
      carryover_items || null,
      retro_notes || null,
      context_type || "staff",
      context_id || null,
    ],
  });
}

// ── POST/GET/PATCH /api/errors — client error reports + triage ──────────────

/** Unresolved matching error from the last 24h, keyed by fingerprint. */
export async function findRecentErrorByFingerprint(fingerprint) {
  return db.execute({
    sql: `SELECT id, occurrence_count FROM error_logs
              WHERE fingerprint = ?
                AND created_at > NOW() - INTERVAL '24 hours'
                AND (resolved IS NULL OR resolved = false)
              ORDER BY created_at DESC
              LIMIT 1`,
    args: [fingerprint],
  });
}

/** Fallback dedup when the fingerprint column is missing (message + page). */
export async function findRecentErrorByMessageAndPage(message, page) {
  return db.execute({
    sql: `SELECT id, occurrence_count FROM error_logs
                WHERE message = ? AND COALESCE(page, '') = COALESCE(?, '')
                  AND created_at > NOW() - INTERVAL '24 hours'
                  AND (resolved IS NULL OR resolved = false)
                ORDER BY created_at DESC
                LIMIT 1`,
    args: [message, page || ""],
  });
}

/** Bump occurrence_count of a deduplicated error and refresh its payload. */
export async function incrementErrorOccurrence(id, newCount, body) {
  return db.execute({
    sql: `UPDATE error_logs
              SET occurrence_count = ?, created_at = NOW(), user_id = ?, user_name = ?, user_role = ?, page = ?, action_attempted = ?, url = ?, status_code = ?, method = ?, endpoint = ?, request_body = ?, user_agent = ?, severity = ?, stack = ?
              WHERE id = ?`,
    args: [
      newCount,
      body.user_id || null,
      body.user_name || null,
      body.user_role || null,
      body.page || null,
      body.action_attempted || null,
      body.url || null,
      body.status_code || null,
      body.method || null,
      body.endpoint || null,
      body.request_body || null,
      body.user_agent || null,
      body.severity || "error",
      body.stack || null,
      id,
    ],
  });
}

/** Insert a new error log row with its category + fingerprint, returning id. */
export async function insertErrorLog(body, category, fingerprint) {
  return db.execute({
    sql: `INSERT INTO error_logs
            (message, stack, url, user_id, user_name, user_role, user_agent,
             severity, status_code, method, endpoint, request_body,
             page, action_attempted, category, fingerprint, occurrence_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            RETURNING id`,
    args: [
      body.message,
      body.stack || null,
      body.url || null,
      body.user_id || null,
      body.user_name || null,
      body.user_role || null,
      body.user_agent || null,
      body.severity || "error",
      body.status_code || null,
      body.method || null,
      body.endpoint || null,
      body.request_body || null,
      body.page || null,
      body.action_attempted || null,
      category,
      fingerprint,
    ],
  });
}

/** Filtered error-log list for the triage view. */
export async function listErrorLogs({ severity, resolved, category, search }) {
  let sql = "SELECT * FROM error_logs WHERE 1=1";
  const args = [];

  if (severity) {
    sql += " AND severity = ?";
    args.push(severity);
  }

  if (resolved === "true") {
    sql += " AND resolved = true";
  } else if (resolved === "false") {
    sql += " AND (resolved IS NULL OR resolved = false)";
  }

  if (category) {
    sql += " AND category = ?";
    args.push(category);
  }

  if (search) {
    sql += " AND message ILIKE ?";
    args.push(`%${search}%`);
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** Resolve/unresolve an error log (clears resolved_at when unresolved). */
export async function updateErrorResolution(id, resolved, resolutionNotes) {
  return db.execute({
    sql: "UPDATE error_logs SET resolved = ?, resolution_notes = ?, resolved_at = CASE WHEN ? THEN NOW() ELSE NULL END WHERE id = ?",
    args: [
      resolved ? 1 : 0,
      resolutionNotes || null,
      resolved ? 1 : 0,
      id,
    ],
  });
}

/** Attach resolution notes to an error log. */
export async function updateErrorResolutionNotes(id, resolutionNotes) {
  return db.execute({
    sql: "UPDATE error_logs SET resolution_notes = ? WHERE id = ?",
    args: [resolutionNotes, id],
  });
}

/** Link an error log to a follow-up task. */
export async function updateErrorTaskId(id, taskId) {
  return db.execute({
    sql: "UPDATE error_logs SET task_id = ? WHERE id = ?",
    args: [taskId, id],
  });
}

// ── GET /api/audit-log — audit trail listing ────────────────────────────────

/** Filtered audit-log entries (entity, user, action) with optional limit. */
export async function listAuditLogs({ entity_type, entity_id, user_id, action, limit }) {
  let sql = "SELECT * FROM audit_log WHERE 1=1";
  const args = [];
  if (entity_type) {
    sql += " AND entity_type = ?";
    args.push(entity_type);
  }
  if (entity_id) {
    sql += " AND entity_id = ?";
    args.push(parseInt(entity_id));
  }
  if (user_id) {
    sql += " AND user_id = ?";
    args.push(user_id);
  }
  if (action) {
    sql += " AND action = ?";
    args.push(action);
  }
  sql += " ORDER BY created_at DESC";
  if (limit) {
    sql += " LIMIT ?";
    args.push(parseInt(limit));
  }

  return db.execute({ sql, args });
}

// ── GET /api/superadmin/full-state — Super Admin dashboard counts ────────────

/** Count of active (non-archived, status = 'active') v2 programs. */
export async function countActiveV2Programs() {
  return db.execute(
    "SELECT COUNT(*) as count FROM v2_programs WHERE is_archived = 0 AND status = 'active'",
  );
}

/** Count of internal projects that are not archived (same rule as the Projects list). */
export async function countActiveProjects() {
  return db.execute(
    "SELECT COUNT(*) as count FROM v2_projects WHERE status != 'Archived'",
  );
}

/** Count of participant contacts (not deleted). */
export async function countParticipantContacts() {
  return db.execute(
    "SELECT COUNT(*) as count FROM contacts WHERE role = 'participant' AND deleted = 0",
  );
}

/** Count of staff contacts (staff role). */
export async function countStaffContacts() {
  return db.execute(
    "SELECT COUNT(*) as count FROM contacts WHERE role IN ('staff')",
  );
}

/** Most recent activity-log entries (10). */
export async function listRecentActivityLogs() {
  return db.execute(
    "SELECT id, user_identity as user, action, module, status, created_at as timestamp FROM activity_logs ORDER BY created_at DESC LIMIT 10",
  );
}

/** Most recently created active programs (5). */
export async function listActiveV2Programs() {
  return db.execute(
    "SELECT id, name, status, created_at FROM v2_programs WHERE is_archived = 0 AND status = 'active' ORDER BY created_at DESC LIMIT 5",
  );
}

