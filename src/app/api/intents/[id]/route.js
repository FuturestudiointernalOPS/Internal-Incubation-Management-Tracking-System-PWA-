import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { getIntentDetailForSession } from "@/services/platform/intents";

/**
 * GET /api/intents/[id]
 *
 * Returns a single Intent with its tasks, blockers, and progress summary.
 * Used for the Intent detail view. Thin controller: the access decision, the
 * task/blocker assembly and the progress summary live in
 * `services/platform/intents`.
 */
export async function GET(req, { params }) {
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

    const { id } = await params;
    const result = await getIntentDetailForSession({ session, id });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("GET intent detail error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
