import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/participant/timeline
 *
 * The current user's own contact timeline. This is a general (not
 * program-scoped) activity log, so it must load for any valid authenticated
 * user regardless of program enrollment. Read-only and self-scoped.
 */
export async function GET(req) {
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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100") || 100,
      200,
    );

    const res = await db.execute({
      sql: `SELECT id, event_type, description, context_module, context_id, created_at
            FROM contact_timeline
            WHERE contact_cid = ?
              AND (context_module IS NULL OR context_module != 'crm')
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [session.cid, limit],
    });

    return NextResponse.json({ success: true, events: res.rows });
  } catch (error) {
    console.error("[participant timeline] error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
