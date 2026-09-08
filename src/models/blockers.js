import db from "@/lib/db";

/**
 * Blockers model — data access for the blockers controllers
 * (`src/app/api/blockers/route.js`, `src/app/api/blockers/discuss/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/** Blockers on tasks the user owns / is assigned to / supervises, newest first. */
export async function getBlockersForUser(scopeCid, filters) {
  const { id, task_id, user_id, status, isSupervisor } = filters;
  let sql = `SELECT b.* FROM blockers b
        JOIN tasks t ON b.task_id = t.id
        WHERE (t.user_id = ? OR t.assigned_to = ? OR t.supervisor_id = ?)`;
  const args = [scopeCid, scopeCid, scopeCid];

  if (id) {
    sql += " AND b.id = ?";
    args.push(parseInt(id));
  }
  if (task_id) {
    sql += " AND b.task_id = ?";
    args.push(parseInt(task_id));
  }
  if (user_id && !isSupervisor) {
    sql += " AND b.user_id = ?";
    args.push(user_id);
  }
  if (status) {
    sql += " AND b.status = ?";
    args.push(status);
  }
  sql += " ORDER BY b.created_at DESC";

  return db.execute({ sql, args });
}

/** Unrestricted blocker list (super admin) with optional filters. */
export async function getAllBlockers(filters) {
  const { id, task_id, user_id, status } = filters;
  let sql = "SELECT * FROM blockers WHERE 1=1";
  const args = [];

  if (id) {
    sql += " AND id = ?";
    args.push(parseInt(id));
  }

  if (task_id) {
    sql += " AND task_id = ?";
    args.push(parseInt(task_id));
  }

  if (user_id) {
    sql += " AND user_id = ?";
    args.push(user_id);
  }

  if (status) {
    sql += " AND status = ?";
    args.push(status);
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** Task ownership/status row used to gate blocker creation on a task. */
export async function getTaskForBlockerCheck(task_id) {
  return db.execute({
    sql: "SELECT id, status, user_id, assigned_to, supervisor_id FROM tasks WHERE id = ?",
    args: [parseInt(task_id)],
  });
}

/** Create a blocker, returning the new row id. */
export async function createBlocker(blocker) {
  const {
    task_id,
    user_id,
    user_name,
    title,
    description,
    severity,
    reference_url,
    notes,
  } = blocker;
  return db.execute({
    sql: `INSERT INTO blockers
        (task_id, user_id, user_name, title, description, severity, reference_url, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      parseInt(task_id),
      user_id,
      user_name || "",
      title,
      description || null,
      severity || "medium",
      reference_url || null,
      notes || null,
    ],
  });
}

/** Auto-mark a task as blocked when a blocker is created on it. */
export async function markTaskBlocked(task_id) {
  return db.execute({
    sql: "UPDATE tasks SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'blocked'",
    args: [parseInt(task_id)],
  });
}

/** Bell notification to all Super Admins when a blocker is created. */
export async function notifySuperAdminsOfBlocker(notification) {
  const { user_name, user_id, title, task_title, now } = notification;
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [
      "sa",
      "New Blocker Created",
      `${user_name || user_id} added blocker "${title}" on task "${task_title}" (${now})`,
      "blocker",
    ],
  });
}

/** Full blocker row by id (used for ownership checks before update/delete). */
export async function getBlockerById(id) {
  return db.execute({
    sql: "SELECT * FROM blockers WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Mark a blocker resolved (records who resolved it). */
export async function resolveBlocker({ id, resolvedBy }) {
  return db.execute({
    sql: "UPDATE blockers SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?",
    args: [resolvedBy, parseInt(id)],
  });
}

/** Any other active blockers on the same task (before reverting task status). */
export async function getOtherActiveBlockersForTask(task_id, exclude_id) {
  return db.execute({
    sql: "SELECT id FROM blockers WHERE task_id = ? AND status = 'active' AND id != ?",
    args: [task_id, parseInt(exclude_id)],
  });
}

/** Revert a blocked task to in_progress once its last blocker is resolved. */
export async function revertTaskFromBlocked(task_id) {
  return db.execute({
    sql: "UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'blocked'",
    args: [task_id],
  });
}

/** Update editable fields (title/description/severity) of a blocker. */
export async function updateBlockerFields(id, changes) {
  const { title, description, severity } = changes;
  const updateFields = [];
  const updateArgs = [];

  if (title !== undefined) {
    updateFields.push("title = ?");
    updateArgs.push(title);
  }
  if (description !== undefined) {
    updateFields.push("description = ?");
    updateArgs.push(description);
  }
  if (severity !== undefined) {
    updateFields.push("severity = ?");
    updateArgs.push(severity);
  }

  if (updateFields.length > 0) {
    updateArgs.push(parseInt(id));
    return db.execute({
      sql: `UPDATE blockers SET ${updateFields.join(", ")} WHERE id = ?`,
      args: updateArgs,
    });
  }
  return null;
}

/** Delete a blocker by id. */
export async function deleteBlocker(id) {
  return db.execute({
    sql: "DELETE FROM blockers WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Discussion messages on a blocker (v2_messages), oldest first. */
export async function getBlockerDiscussions(blocker_id) {
  return db.execute({
    sql: `SELECT id, sender_id, body, target_type, target_id, created_at
            FROM v2_messages
            WHERE target_type = 'blocker' AND target_id = ?
            ORDER BY created_at ASC`,
    args: [blocker_id],
  });
}

/** Blocker identity row (id, user_id, title, task_id) used to gate discussions. */
export async function getBlockerForDiscussion(blocker_id) {
  return db.execute({
    sql: "SELECT id, user_id, title, task_id FROM blockers WHERE id = ?",
    args: [parseInt(blocker_id)],
  });
}

/** Create a discussion message on a blocker (v2_messages), returning id + created_at. */
export async function createBlockerDiscussion(message) {
  const { blocker_id, sender_id, body } = message;
  return db.execute({
    sql: `INSERT INTO v2_messages (sender_id, body, target_type, target_id)
            VALUES (?, ?, 'blocker', ?)
            RETURNING id, created_at`,
    args: [sender_id, body.trim(), blocker_id],
  });
}

/** Notify the blocker creator that someone commented on their blocker. */
export async function notifyBlockerCreatorOfDiscussion(notification) {
  const { user_id, sender_name, blocker_title } = notification;
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read)
                VALUES (?, ?, ?, ?, 0)`,
    args: [
      user_id,
      "New Discussion on Blocker",
      `${sender_name || "Someone"} commented on your blocker: "${blocker_title}"`,
      "blocker_discussion",
    ],
  });
}

/** Notify Super Admins of a new blocker discussion (when they are not the sender). */
export async function notifySuperAdminOfDiscussion(notification) {
  const { sender_name, blocker_title } = notification;
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read)
                VALUES (?, ?, ?, ?, 0)`,
    args: [
      "sa",
      "New Discussion on Blocker",
      `${sender_name || "Someone"} commented on blocker: "${blocker_title}"`,
      "blocker_discussion",
    ],
  });
}
