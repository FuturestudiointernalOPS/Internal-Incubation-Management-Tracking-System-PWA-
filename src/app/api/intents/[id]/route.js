import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getActiveBlockersForIntent,
  getBlockersForTask,
  getIntentById,
  getTasksForIntent,
  getVentureMembership,
} from "@/models/intents";

/**
 * GET /api/intents/[id]
 *
 * Returns a single Intent with its tasks, blockers, and progress summary.
 * Used for the Intent detail view.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await params;

    // Fetch intent
    const intentResult = await getIntentById(id);

    if (intentResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Intent not found" },
        { status: 404 },
      );
    }

    const intent = intentResult.rows[0];

    // SECURITY: Only responsible person, SA, or same-context users can view
    if (
      session.role !== "super_admin" &&
      String(intent.responsible_id) !== String(session.cid)
    ) {
      // For venture contexts, check membership
      if (intent.context_type === "venture" && intent.context_id) {
        const memberCheck = await getVentureMembership(
          intent.context_id,
          session.cid,
        );
        if (memberCheck.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: "You do not have access to this intent." },
            { status: 403 },
          );
        }
      } else if (intent.context_type !== "staff") {
        return NextResponse.json(
          { success: false, error: "You do not have access to this intent." },
          { status: 403 },
        );
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

    // Fetch blocker summary for the intent
    const blockerSummary = await getActiveBlockersForIntent(id);

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("GET intent detail error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
