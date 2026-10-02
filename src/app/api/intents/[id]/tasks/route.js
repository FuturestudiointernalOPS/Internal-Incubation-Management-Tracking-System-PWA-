import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { createIntentTaskForSession } from "@/services/platform/intents";

/**
 * POST /api/intents/[id]/tasks
 *
 * Creates a task under a specific Intent.
 * Auto-inherits context_type, context_id, and supervisor_id from the Intent.
 *
 * Thin controller: the access decision, the Contact-Group assignment rule and
 * the inherited context/week defaults live in `services/platform/intents`.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id: intentId } = await params;
    const body = await req.json();
    const result = await createIntentTaskForSession({
      session,
      intentId,
      input: body,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST intent tasks error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
