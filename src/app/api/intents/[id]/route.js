import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

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
    const intentRes = await db.execute({
      sql: "SELECT * FROM intents WHERE id = ?",
      args: [id],
    });

    if (intentRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Intent not found" },
        { status: 404 },
      );
    }

    const intent = intentRes.rows[0];

    // SECURITY: Only responsible person, SA, or same-context users can view
    if (
      session.role !== "super_admin" &&
      String(intent.responsible_id) !== String(session.cid)
    ) {
      // For venture contexts, check membership
      if (intent.context_type === "venture" && intent.context_id) {
        const memberCheck = await db.execute({
          sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
          args: [intent.context_id, session.cid],
        });
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
    const taskRes = await db.execute({
      sql: `SELECT * FROM tasks WHERE intent_id = ?
        ORDER BY CASE priority
          WHEN 'critical' THEN 0 WHEN 'high' THEN 1
          WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
        END, created_at ASC`,
      args: [id],
    });

    const tasks = await Promise.all(
      taskRes.rows.map(async (task) => {
        const blockerRes = await db.execute({
          sql: "SELECT id, title, status, severity FROM blockers WHERE task_id = ? ORDER BY created_at DESC",
          args: [task.id],
        });
        return { ...task, blockers: blockerRes.rows || [] };
      }),
    );

    // Progress summary
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const inProgress = tasks.filter((t) =>
      ["in_progress", "carried_over"].includes(t.status),
    ).length;

    // Fetch blocker summary for the intent
    const blockerSummary = await db.execute({
      sql: `SELECT b.*, t.title AS task_title FROM blockers b
        JOIN tasks t ON b.task_id = t.id
        WHERE t.intent_id = ? AND b.status = 'active'
        ORDER BY b.created_at DESC`,
      args: [id],
    });

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
