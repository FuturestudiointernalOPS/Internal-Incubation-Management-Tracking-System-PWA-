import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { reconcileTasks } from "@/services/tasks/reconcile";

/**
 * TASK RECONCILE API — controller layer.
 *
 * POST /api/tasks/reconcile
 * Body: { user_id, user_name, tasks: [{ id, status, force_complete }] }
 *
 * Status options: 'completed', 'carried_over', 'in_progress'.
 * The per-task rules (own-scope, allowed statuses, ancestor completion, audit)
 * live in `@/services/tasks/reconcile`.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { user_id, user_name, tasks } = await req.json();

    if (!user_id || !tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: "user_id and tasks array are required" },
        { status: 400 },
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const result = await reconcileTasks({
      userId: user_id,
      userName: user_name,
      tasks,
      role: session.role,
      sessionCid: session.cid,
    });

    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST reconcile error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
