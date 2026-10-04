import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import {
  listBlockerDiscussions,
  postBlockerDiscussion,
} from "@/services/tasks/blockers";

/**
 * BLOCKER DISCUSSIONS API (Ticket 1.9) — controller layer.
 *
 * GET  /api/blockers/discuss?blocker_id=X
 *   - Returns all messages linked to a blocker, oldest first
 *
 * POST /api/blockers/discuss
 *   - Creates a new discussion message on a blocker
 *   - Body: { blocker_id, sender_id, sender_name, body }
 *   - Notifies the blocker creator if someone else comments
 *
 * Auth and response shaping only; the decisions live in
 * `@/services/tasks/blockers` (see docs/LAYER_SPLIT.md).
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const blocker_id = searchParams.get("blocker_id");

    const result = await listBlockerDiscussions({ blocker_id });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("GET blockers/discuss error:", error);
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
    const body = await req.json();

    const result = await postBlockerDiscussion({ input: body });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST blockers/discuss error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
