import db from "@/lib/db";

/**
 * Tasks model — the filtered task list (REPOSITORY layer).
 *
 * Split verbatim out of `models/tasks.js`; the authorization scope is decided by
 * the caller, the assembled SQL text lives here (see docs/LAYER_SPLIT.md).
 */

/**
 * Task list with the GET handler's authorization scoping + filters.
 * The SQL is assembled exactly as the controller used to assemble it
 * (scope is decided by the controller; the SQL text lives here).
 */
export async function getTasksByFilters({
  isSuperAdmin,
  scope,
  sessionCid,
  effectiveUserId,
  assignedTo,
  projectId,
  status,
  priority,
  week,
  year,
  sort,
  limit,
}) {
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const args = [];

  // SECURITY (Phase 0/6): For non-SA users, scope to: owned tasks, assigned tasks, or supervised tasks.
  // When an explicit assigned_to filter is given, use that. Otherwise scope by session user.
  if (!isSuperAdmin) {
    if (scope === "self") {
      // No user/assignee filter given (with or without project_id): force scope to session user
      sql += " AND (user_id = ? OR assigned_to = ? OR supervisor_id = ?)";
      args.push(sessionCid, sessionCid, sessionCid);
    } else if (scope === "user") {
      // Explicit user_id filter (pre-authorized above): scope to that user
      sql += " AND user_id = ?";
      args.push(effectiveUserId);
      if (assignedTo) {
        sql += " AND assigned_to = ?";
        args.push(assignedTo);
      }
    } else if (scope === "assigned") {
      // Non-SA requesting by assigned_to: only own assignments (controller enforces equality)
      sql += " AND assigned_to = ?";
      args.push(assignedTo);
    } else {
      // FAIL CLOSED. A non-super-admin whose scope was not recognised (or was
      // not supplied) must never fall through to an unfiltered list of every
      // task in the platform — the one outcome worse than refusing is leaking.
      sql += " AND 1 = 0";
    }
  } else {
    // Super admin: apply filters as requested
    if (effectiveUserId) {
      sql += " AND user_id = ?";
      args.push(effectiveUserId);
    }
    if (assignedTo) {
      sql += " AND assigned_to = ?";
      args.push(assignedTo);
    }
  }

  if (projectId) {
    sql += " AND project_id::text = ?";
    args.push(projectId);
  }

  if (status) {
    sql += " AND status = ?";
    args.push(status);
  }

  if (priority) {
    sql += " AND priority = ?";
    args.push(priority);
  }

  if (week) {
    sql += " AND created_week = ?";
    args.push(parseInt(week));
  }

  if (year) {
    sql += " AND created_year = ?";
    args.push(parseInt(year));
  }

  // Sorting
  switch (sort) {
    case "oldest":
      sql += " ORDER BY created_at ASC";
      break;
    case "updated":
      sql += " ORDER BY updated_at DESC";
      break;
    case "priority":
      sql +=
        " ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END, created_at DESC";
      break;
    default:
      sql += " ORDER BY created_at DESC";
  }

  if (limit) {
    sql += " LIMIT ?";
    args.push(parseInt(limit));
  }

  return db.execute({ sql, args });
}
