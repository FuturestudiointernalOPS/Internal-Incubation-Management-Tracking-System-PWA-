import db from "@/lib/db";

/**
 * Intents model — data access for the intent controllers
 * (`src/app/api/intents/route.js`, `src/app/api/intents/[id]/route.js`,
 *  `src/app/api/intents/[id]/tasks/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/**
 * Intent list with the GET handler's authorization scoping + filters.
 * The SQL is assembled exactly as the controller used to assemble it
 * (the non-SA 403 gate is decided by the controller; the SQL text lives here).
 */
export async function getIntentsByFilters({
  isSuperAdmin,
  sessionCid,
  responsibleId,
  contextType,
  contextId,
  status,
  projectId,
}) {
  let sql = "SELECT * FROM intents WHERE 1=1";
  const args = [];

  // SECURITY: Non-SA users see only their own intents + intents in their context
  if (!isSuperAdmin) {
    // User can see intents they're responsible for, or intents in their context
    if (responsibleId) {
      sql += " AND responsible_id = ?";
      args.push(String(responsibleId));
    } else {
      // See intents where responsible OR in same context
      sql += " AND (responsible_id = ?";
      args.push(String(sessionCid));
      if (contextType) {
        sql += " OR context_type = ?";
        args.push(contextType);
      }
      sql += ")";
    }
  } else {
    // SA: apply filters as given
    if (responsibleId) {
      sql += " AND responsible_id = ?";
      args.push(responsibleId);
    }
  }

  if (contextType) {
    sql += " AND context_type = ?";
    args.push(contextType);
  }

  if (contextId) {
    sql += " AND context_id = ?";
    args.push(contextId);
  }

  if (status) {
    sql += " AND status = ?";
    args.push(status);
  }

  if (projectId) {
    sql += " AND project_id = ?";
    args.push(projectId);
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** Per-intent task counts (active/completed/total) for a set of intent ids. */
export async function getIntentTaskCounts(intentIds) {
  const idsPh = intentIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT intent_id::text AS iid,
            COUNT(*) FILTER (WHERE status NOT IN ('completed','archived')) AS active_count,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
            COUNT(*) AS total_count
            FROM tasks WHERE intent_id::text IN (${idsPh})
            GROUP BY intent_id::text`,
    args: intentIds,
  });
}

/** Contact row (cid, name) used to verify the responsible person exists. */
export async function getContactForResponsibleCheck(responsibleId) {
  return db.execute({
    sql: "SELECT cid, name FROM contacts WHERE cid = ?",
    args: [responsibleId],
  });
}

/** Create an intent, returning the new row id. */
export async function createIntent(intent) {
  const {
    title,
    description,
    responsible_id,
    context_type,
    context_id,
    contact_group_id,
    project_id,
    status,
    start_date,
    target_date,
  } = intent;
  return db.execute({
    sql: `INSERT INTO intents
        (title, description, responsible_id, context_type, context_id,
         contact_group_id, project_id, status, start_date, target_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id`,
    args: [
      title,
      description || null,
      responsible_id,
      context_type,
      context_id || null,
      contact_group_id || null,
      project_id || null,
      status || "active",
      start_date || null,
      target_date || null,
    ],
  });
}

/** Existing intent row by id, fetched before an update (existence/ownership). */
export async function getExistingIntent(id) {
  return db.execute({
    sql: "SELECT * FROM intents WHERE id = ?",
    args: [id],
  });
}

/** Apply a prebuilt set of `SET col = ?` fragments to an intent row. */
export async function updateIntentFields(updateFields, updateArgs) {
  return db.execute({
    sql: `UPDATE intents SET ${updateFields.join(", ")} WHERE id = ?`,
    args: updateArgs,
  });
}

/** Intent row by id used by the delete handler (ownership check + audit). */
export async function getIntentToDelete(id) {
  return db.execute({
    sql: "SELECT * FROM intents WHERE id = ?",
    args: [id],
  });
}

/** Unlink an intent's tasks (clear intent_id + supervisor_id) before delete. */
export async function unlinkTasksFromIntent(id) {
  return db.execute({
    sql: "UPDATE tasks SET intent_id = NULL, supervisor_id = NULL WHERE intent_id = ?",
    args: [id],
  });
}

/** Delete an intent by id. */
export async function deleteIntent(id) {
  return db.execute({
    sql: "DELETE FROM intents WHERE id = ?",
    args: [id],
  });
}

/** Full intent row by id (single-intent detail view). */
export async function getIntentById(id) {
  return db.execute({
    sql: "SELECT * FROM intents WHERE id = ?",
    args: [id],
  });
}

/** Membership row used to grant venture-context users access to an intent. */
export async function getVentureMembership(ventureId, contactId) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
    args: [ventureId, contactId],
  });
}

/** Tasks under an intent, priority-first then oldest created. */
export async function getTasksForIntent(intentId) {
  return db.execute({
    sql: `SELECT * FROM tasks WHERE intent_id = ?
        ORDER BY CASE priority
          WHEN 'critical' THEN 0 WHEN 'high' THEN 1
          WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
        END, created_at ASC`,
    args: [intentId],
  });
}

/** Blockers (id, title, status, severity) on a single task, newest first. */
export async function getBlockersForTask(taskId) {
  return db.execute({
    sql: "SELECT id, title, status, severity FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
    args: [taskId],
  });
}

/** Active blockers on any task of an intent (with task title), newest first. */
export async function getActiveBlockersForIntent(intentId) {
  return db.execute({
    sql: `SELECT b.*, t.title AS task_title FROM blockers b
        JOIN tasks t ON b.task_id = t.id
        WHERE t.intent_id = ? AND b.status = 'active'
        ORDER BY b.created_at DESC`,
    args: [intentId],
  });
}

/** Intent row fetched before creating a task under it (context inheritance). */
export async function getIntentForTaskCreation(intentId) {
  return db.execute({
    sql: "SELECT * FROM intents WHERE id = ?",
    args: [intentId],
  });
}

/** Membership gate for adding tasks to a venture-context intent. */
export async function checkVentureMembership(ventureId, contactId) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
    args: [ventureId, contactId],
  });
}

/** Create a task under an intent (context/supervisor values come resolved). */
export async function createIntentTask(task) {
  const {
    user_id,
    user_name,
    title,
    description,
    project_id,
    category,
    created_week,
    created_year,
    start_date,
    end_date,
    assigned_to,
    priority,
    context_type,
    context_id,
    supervisor_id,
    intent_id,
  } = task;
  return db.execute({
    sql: `INSERT INTO tasks
        (user_id, user_name, title, description, status, project_id, category,
         created_week, created_year, start_date, end_date, assigned_to, priority,
         context_type, context_id, supervisor_id, intent_id)
        VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?)
        RETURNING id`,
    args: [
      user_id,
      user_name,
      title,
      description,
      project_id,
      category,
      created_week,
      created_year,
      start_date,
      end_date,
      assigned_to,
      priority,
      context_type,
      context_id,
      supervisor_id,
      intent_id,
    ],
  });
}
