import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import {
  createBlockerForTask,
  deleteBlockerRecord,
  listBlockers,
  updateBlockerRecord,
} from "@/services/tasks/blockers";

/**
 * BLOCKERS API — controller layer.
 *
 * GET    /api/blockers?task_id=X&user_id=X&status=active
 *   - Returns blockers, filtered by query params
 *
 * POST   /api/blockers
 *   - Creates a new blocker (must be tied to a task)
 *
 * PUT    /api/blockers
 *   - Updates a blocker (only creator can resolve)
 *
 * DELETE /api/blockers?id=X
 *   - Deletes a blocker by ID
 *
 * Auth and response shaping only; every decision lives in
 * `@/services/tasks/blockers` (see docs/LAYER_SPLIT.md).
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const { searchParams } = new URL(req.url);

    const result = await listBlockers({
      session,
      filters: {
        id: searchParams.get("id"),
        task_id: searchParams.get("task_id"),
        user_id: searchParams.get("user_id"),
        status: searchParams.get("status"),
      },
    });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("GET blockers error:", error);
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
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    const body = await req.json();

    const result = await createBlockerForTask({ session, input: body });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST blockers error:", error);
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
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const body = await req.json();

    const result = await updateBlockerRecord({ session, input: body });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("PUT blockers error:", error);
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
    const { getSession } = await import("@/server/auth/session");
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

    const result = await deleteBlockerRecord({ session, id });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("DELETE blockers error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
