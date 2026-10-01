import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listTasks } from "@/services/tasks/query";
import { createTaskRecord } from "@/services/tasks/create";
import { updateTaskRecord } from "@/services/tasks/update";
import { deleteTaskRecord } from "@/services/tasks/remove";
import { respondToPendingAssignment } from "@/services/tasks/assignments";

/**
 * TASKS API — controller layer.
 *
 * GET    /api/tasks?user_id=X&status=in_progress&week=12&year=2026
 * POST   /api/tasks
 * PUT    /api/tasks
 * DELETE /api/tasks?id=X
 * PATCH  /api/tasks  (accept/decline a pending assignment)
 *
 * Auth, validation and response shaping only; every use case lives in
 * `@/services/tasks/*` (see docs/LAYER_SPLIT.md). The roles that may set a
 * task's management fields (`supervisor_id`) are gated in the services.
 */

export async function GET(req) {
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
    const { searchParams } = new URL(req.url);

    const result = await listTasks({
      userId: searchParams.get("user_id"),
      assignedTo: searchParams.get("assigned_to"),
      projectId: searchParams.get("project_id"),
      status: searchParams.get("status"),
      weekNumber: searchParams.get("week"),
      year: searchParams.get("year"),
      id: searchParams.get("id"),
      sort: searchParams.get("sort"),
      limit: searchParams.get("limit"),
      brief: searchParams.get("brief") === "true",
      priority: searchParams.get("priority"),
      role: session.role,
      sessionCid: session.cid,
    });

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("GET tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    const body = await req.json();

    if (!body.user_id || !body.title || !body.created_week || !body.created_year) {
      return NextResponse.json(
        {
          success: false,
          error: "user_id, title, created_week, and created_year are required",
        },
        { status: 400 },
      );
    }

    const result = await createTaskRecord({
      input: body,
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
    console.error("POST tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
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
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    const result = await updateTaskRecord({
      id: body.id,
      input: body,
      role: session.role,
      sessionCid: session.cid,
      sessionName: session.name,
    });
    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("PUT tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id query parameter is required" },
        { status: 400 },
      );
    }

    const result = await deleteTaskRecord({
      id,
      role: session.role,
      sessionCid: session.cid,
      sessionName: session.name,
    });
    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("DELETE tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/tasks
 *
 * Accept or decline a pending task assignment.
 * Body: { action: "accept" | "decline", task_assignment_id?: number, task_id?: number }
 *
 * If task_assignment_id is provided, it looks up that specific record.
 * Otherwise, it uses task_id + the authenticated user's session cid.
 */
export async function PATCH(req) {
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
    const body = await req.json();
    const { action, task_assignment_id, task_id } = body;

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid action ('accept' or 'decline') is required.",
        },
        { status: 400 },
      );
    }

    if (!task_assignment_id && !task_id) {
      return NextResponse.json(
        {
          success: false,
          error: "task_assignment_id or task_id is required.",
        },
        { status: 400 },
      );
    }

    const result = await respondToPendingAssignment({
      action,
      taskAssignmentId: task_assignment_id,
      taskId: task_id,
      sessionCid: session.cid,
      sessionName: session.name,
    });
    if (result.error) {
      return NextResponse.json(
        result.body || { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("PATCH tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
