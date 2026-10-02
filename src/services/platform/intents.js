/**
 * Platform — intents (SERVICE layer).
 *
 * The domain decisions behind `/api/intents` and its sub-routes: who may list,
 * read, create, update or delete an Intent (and add tasks under it), the
 * responsible/context defaults, the Contact-Group assignment rule, the task
 * counts batch and the progress summary. The CONTROLLER keeps `requireAuth`,
 * `initDb`, the request parsing and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and shaping, no HTTP. It reads and
 * writes through `@/models/**` and records the audit trail through the tasks
 * audit service. Every function returns `{ status, body }` for the controller to
 * serialise, and lets an unexpected failure propagate to its try/catch (500).
 */

import {
  checkVentureMembership,
  createIntent,
  createIntentTask,
  deleteIntent,
  getActiveBlockersForIntent,
  getBlockersForTask,
  getContactForResponsibleCheck,
  getExistingIntent,
  getIntentById,
  getIntentForTaskCreation,
  getIntentTaskCounts,
  getIntentToDelete,
  getIntentsByFilters,
  getTasksForIntent,
  getVentureMembership,
  unlinkTasksFromIntent,
  updateIntentFields,
} from "@/models/intents";
import { validateTaskAssignment } from "@/models/contactGroups";
import { logAuditEvent } from "@/services/tasks/auditLog";

/** Current ISO week number and year — carried over from the route verbatim. */
function getCurrentWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 604800000;
  const week = Math.ceil((diff / oneWeek + start.getDay() + 1) / 7);
  return { week: Math.min(week, 52), year: now.getFullYear() };
}

/**
 * GET /api/intents — list intents filtered by context, status, responsible.
 *
 * SECURITY: a non-SA session may only ask for its OWN id as `responsible_id`;
 * the repository still narrows the row scope, but the refusal is a decision.
 */
export async function listIntentsForSession({ session, filters }) {
  const { contextType, contextId, responsibleId, status, projectId } = filters;

  if (
    session.role !== "super_admin" &&
    responsibleId &&
    String(responsibleId) !== String(session.cid)
  ) {
    return {
      status: 403,
      body: { success: false, error: "You can only view your own intents." },
    };
  }

  // SQL assembled in src/models/intents.js (getIntentsByFilters)
  const result = await getIntentsByFilters({
    isSuperAdmin: session.role === "super_admin",
    sessionCid: session.cid,
    responsibleId,
    contextType,
    contextId,
    status,
    projectId,
  });

  // Batch per-intent task counts into ONE grouped query instead of one query per
  // intent. Produces identical `taskCounts` per intent.
  const intentIds = result.rows.map((intent) => String(intent.id));
  const countMap = {};
  if (intentIds.length > 0) {
    const countResult = await getIntentTaskCounts(intentIds);
    for (const countRow of countResult.rows || []) countMap[countRow.iid] = countRow;
  }

  const intents = result.rows.map((intent) => {
    const intentId = String(intent.id);
    return {
      ...intent,
      taskCounts: countMap[intentId] || {
        active_count: 0,
        completed_count: 0,
        total_count: 0,
      },
    };
  });

  return { status: 200, body: { success: true, intents } };
}

/** POST /api/intents — create an Intent (the responsible person must exist). */
export async function createIntentForSession({ session, input }) {
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
  } = input;

  if (!title) {
    return { status: 400, body: { success: false, error: "title is required" } };
  }

  const finalResponsibleId = responsible_id || session.cid;
  const finalContextType = context_type || "staff";

  // SECURITY: Verify responsible person exists
  const responsibleCheck = await getContactForResponsibleCheck(finalResponsibleId);
  if (responsibleCheck.rows.length === 0) {
    return { status: 400, body: { success: false, error: "Responsible person not found." } };
  }

  const result = await createIntent({
    title,
    description,
    responsible_id: finalResponsibleId,
    context_type: finalContextType,
    context_id,
    contact_group_id,
    project_id,
    status,
    start_date,
    target_date,
  });

  const intentId = result.rows[0].id;

  await logAuditEvent({
    entity_type: "intent",
    entity_id: intentId,
    user_id: session.cid,
    user_name: session.name || "",
    action: "created",
    details: `Intent "${title}" created`,
    metadata: {
      title,
      context_type: finalContextType,
      context_id: context_id || null,
      responsible_id: finalResponsibleId,
    },
  });

  return { status: 200, body: { success: true, id: intentId, action: "created" } };
}

/** PUT /api/intents — update an Intent (only its responsible person or SA). */
export async function updateIntentForSession({ session, input }) {
  const {
    id,
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
  } = input;

  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const existing = await getExistingIntent(id);
  if (existing.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Intent not found" } };
  }

  const intent = existing.rows[0];

  // SECURITY: Only responsible person or SA can update
  if (
    session.role !== "super_admin" &&
    String(intent.responsible_id) !== String(session.cid)
  ) {
    return {
      status: 403,
      body: { success: false, error: "Only the responsible person can update this intent." },
    };
  }

  const updates = [];
  const args = [];

  if (title !== undefined) {
    updates.push("title = ?");
    args.push(title);
  }
  if (description !== undefined) {
    updates.push("description = ?");
    args.push(description);
  }
  if (responsible_id !== undefined) {
    updates.push("responsible_id = ?");
    args.push(responsible_id);
  }
  if (context_type !== undefined) {
    updates.push("context_type = ?");
    args.push(context_type);
  }
  if (context_id !== undefined) {
    updates.push("context_id = ?");
    args.push(context_id);
  }
  if (contact_group_id !== undefined) {
    updates.push("contact_group_id = ?");
    args.push(contact_group_id);
  }
  if (project_id !== undefined) {
    updates.push("project_id = ?");
    args.push(project_id);
  }
  if (status !== undefined) {
    updates.push("status = ?");
    args.push(status);
    if (status === "completed") {
      updates.push("completed_at = NOW()");
    }
  }
  if (start_date !== undefined) {
    updates.push("start_date = ?");
    args.push(start_date);
  }
  if (target_date !== undefined) {
    updates.push("target_date = ?");
    args.push(target_date);
  }

  if (updates.length === 0) {
    return { status: 400, body: { success: false, error: "No fields to update" } };
  }

  updates.push("updated_at = NOW()");
  args.push(id);

  await updateIntentFields(updates, args);

  await logAuditEvent({
    entity_type: "intent",
    entity_id: id,
    user_id: session.cid,
    user_name: session.name || "",
    action: "updated",
    details: `Intent "${intent.title}" updated`,
    metadata: { updated_fields: Object.keys(input).filter((key) => key !== "id") },
  });

  return { status: 200, body: { success: true, action: "updated" } };
}

/** DELETE /api/intents — unlink the tasks, then delete (responsible or SA). */
export async function deleteIntentForSession({ session, id }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const existing = await getIntentToDelete(id);
  if (existing.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Intent not found" } };
  }

  const intent = existing.rows[0];

  // SECURITY: Only responsible person or SA can delete
  if (
    session.role !== "super_admin" &&
    String(intent.responsible_id) !== String(session.cid)
  ) {
    return {
      status: 403,
      body: { success: false, error: "Only the responsible person can delete this intent." },
    };
  }

  // Unlink tasks (set intent_id to NULL, remove supervisor)
  await unlinkTasksFromIntent(id);

  // Delete the intent
  await deleteIntent(id);

  await logAuditEvent({
    entity_type: "intent",
    entity_id: id,
    user_id: session.cid,
    user_name: session.name || "",
    action: "deleted",
    details: `Intent "${intent.title}" deleted`,
  });

  return { status: 200, body: { success: true, action: "deleted" } };
}

/**
 * GET /api/intents/[id] — one Intent with its tasks, blockers and progress.
 *
 * SECURITY: the responsible person or SA always pass; everyone else needs a
 * venture membership (venture context) — a non-venture, non-staff context is
 * refused.
 */
export async function getIntentDetailForSession({ session, id }) {
  const intentResult = await getIntentById(id);

  if (intentResult.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Intent not found" } };
  }

  const intent = intentResult.rows[0];

  if (
    session.role !== "super_admin" &&
    String(intent.responsible_id) !== String(session.cid)
  ) {
    // For venture contexts, check membership
    if (intent.context_type === "venture" && intent.context_id) {
      const memberCheck = await getVentureMembership(intent.context_id, session.cid);
      if (memberCheck.rows.length === 0) {
        return {
          status: 403,
          body: { success: false, error: "You do not have access to this intent." },
        };
      }
    } else if (intent.context_type !== "staff") {
      return {
        status: 403,
        body: { success: false, error: "You do not have access to this intent." },
      };
    }
  }

  // Fetch tasks under this intent with blockers
  const taskResult = await getTasksForIntent(id);

  const tasks = await Promise.all(
    taskResult.rows.map(async (task) => {
      const blockerResult = await getBlockersForTask(task.id);
      return { ...task, blockers: blockerResult.rows || [] };
    }),
  );

  // Progress summary
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const inProgress = tasks.filter((task) =>
    ["in_progress", "carried_over"].includes(task.status),
  ).length;

  const blockerSummary = await getActiveBlockersForIntent(id);

  return {
    status: 200,
    body: {
      success: true,
      intent,
      tasks,
      summary: {
        totalTasks: total,
        completed,
        blocked,
        inProgress,
        progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      activeBlockers: blockerSummary.rows || [],
    },
  };
}

/**
 * POST /api/intents/[id]/tasks — create a task under an Intent.
 *
 * The task INHERITS the intent's context and supervisor. The Contact-Group rule
 * still applies: a non-SA may only assign an assignee that shares a group with
 * the intent's responsible person.
 */
export async function createIntentTaskForSession({ session, intentId, input }) {
  const intentResult = await getIntentForTaskCreation(intentId);

  if (intentResult.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Intent not found" } };
  }

  const intent = intentResult.rows[0];

  // SECURITY: Only staff, SA, or the same-context users can add tasks to intent
  if (
    session.role !== "super_admin" &&
    String(intent.responsible_id) !== String(session.cid)
  ) {
    // For venture intents, check membership
    if (intent.context_type === "venture" && intent.context_id) {
      const memberCheck = await checkVentureMembership(intent.context_id, session.cid);
      if (memberCheck.rows.length === 0) {
        return {
          status: 403,
          body: {
            success: false,
            error: "You do not have permission to add tasks to this intent.",
          },
        };
      }
    } else {
      return {
        status: 403,
        body: {
          success: false,
          error: "Only the responsible person can add tasks to this intent.",
        },
      };
    }
  }

  const {
    user_id,
    user_name,
    title,
    description,
    assigned_to,
    project_id,
    category,
    start_date,
    end_date,
    priority,
    created_week,
    created_year,
  } = input;

  if (!title) {
    return { status: 400, body: { success: false, error: "title is required" } };
  }

  const finalUserId = user_id || session.cid;
  const finalAssignedTo = assigned_to || null;

  // Contact Group enforcement for assignment under intent
  if (finalAssignedTo && session.role !== "super_admin") {
    const groupCheck = await validateTaskAssignment(finalUserId, finalAssignedTo, {
      context_type: intent.context_type,
      context_id: intent.context_id,
    });
    if (!groupCheck.allowed) {
      return {
        status: 403,
        body: {
          success: false,
          error: `Cannot assign task outside the Intent's Contact Group. ${groupCheck.reason || "No shared group found."}`,
        },
      };
    }
  }

  // Inherit context + supervisor from intent
  const finalContextType = intent.context_type;
  const finalContextId = intent.context_id;
  const finalSupervisorId = intent.responsible_id;

  // Determine week/year
  const weekNum = created_week || getCurrentWeekNumber().week;
  const yearNum = created_year || getCurrentWeekNumber().year;

  const result = await createIntentTask({
    user_id: finalUserId,
    user_name: user_name || session.name || "",
    title,
    description: description || null,
    project_id: project_id || intent.project_id || null,
    category: category || null,
    created_week: weekNum,
    created_year: yearNum,
    start_date: start_date || null,
    end_date: end_date || null,
    assigned_to: finalAssignedTo,
    priority: priority || "medium",
    context_type: finalContextType,
    context_id: finalContextId,
    supervisor_id: finalSupervisorId,
    intent_id: intentId,
  });

  const taskId = Number(result.rows[0]?.id || result.lastInsertRowid);

  return {
    status: 200,
    body: { success: true, id: taskId, intent_id: intentId, action: "created" },
  };
}
