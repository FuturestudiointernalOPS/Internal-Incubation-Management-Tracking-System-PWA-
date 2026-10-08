/**
 * Platform — intents: the detail use case (SERVICE layer).
 *
 * One Intent with its tasks, blockers and progress summary, plus the
 * responsible/owner/venture-membership access rule. Split of
 * `services/platform/intents.js` — see docs/LAYER_SPLIT.md; the barrel at the
 * original path re-exports the same surface.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It reads through `@/models/**`.
 */

import {
  getActiveBlockersForIntent,
  getBlockersForTask,
  getIntentById,
  getTasksForIntent,
  getVentureMembership,
} from "@/models/intents";

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
