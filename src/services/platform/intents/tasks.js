/**
 * Platform — intents: the task-creation use case (SERVICE layer).
 *
 * Create a task under an Intent: the per-context access rule, the inherited
 * context/supervisor, the Contact-Group assignment rule and the week/year
 * default. Split of `services/platform/intents.js` — see docs/LAYER_SPLIT.md;
 * the barrel at the original path re-exports the same surface.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It writes through `@/models/**`.
 */

import { checkVentureMembership, createIntentTask, getIntentForTaskCreation } from "@/models/intents";
import { validateTaskAssignment } from "@/models/contactGroups";

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
