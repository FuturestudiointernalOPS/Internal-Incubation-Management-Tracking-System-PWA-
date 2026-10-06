import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { listCarryoverTasks, carryOverTask } from "@/services/tasks/carryover";

/**
 * TASK CARRY-OVER API — controller layer.
 *
 * GET  /api/tasks/carryover?user_id=X&week=W&year=Y
 * POST /api/tasks/carryover  { task_id, target_week, target_year }
 *
 * The chain walk, the completed/idempotency guards and the ownership rule live
 * in `@/services/tasks/carryover`.
 */

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const { getSession } = await import("@/server/auth/session");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const result = await listCarryoverTasks({
    role: session.role,
    sessionCid: session.cid,
    requestedCid: searchParams.get("user_id"),
    weekNumber: searchParams.get("week"),
    year: searchParams.get("year"),
  });

  if (result.error) {
    return NextResponse.json(
      result.body || { success: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.body, { status: result.status });
});

// POST /api/tasks/carryover — shared carry-over operation (Ticket 2.4)
// Clones a task, migrates blockers/comments/resources/subtasks, marks old as carried_over
export const POST = createHandler(async (req) => {
  const body = await req.json();
  const { task_id, target_week, target_year } = body;

  const { getSession } = await import("@/server/auth/session");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!task_id || !target_week || !target_year) {
    return NextResponse.json(
      {
        success: false,
        error: "task_id, target_week, and target_year are required",
      },
      { status: 400 },
    );
  }

  const result = await carryOverTask({
    taskId: task_id,
    targetWeek: target_week,
    targetYear: target_year,
    actorName: session.name || session.cid,
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
});
