import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { getProgramHistory } from "@/lib/program-history";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/history
 *
 * Derives the current user's contextual program history. This is a read-only
 * view built from the existing participant/facilitator/program-staff tables —
 * no new schema is required.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const history = await getProgramHistory({
      cid: session.cid,
      email: session.email,
    });

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("[Profile history] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
