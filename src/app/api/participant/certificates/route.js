import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/participant/certificates
 *
 * Certificates issued to the current user (participant_programs rows with
 * certificate_issued = true). Returns an empty list when none exist.
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

    const res = await db.execute({
      sql: `SELECT CAST(pp.program_id AS TEXT) AS program_id,
                   p.name AS program_name,
                   pp.certificate_issued,
                   pp.completed_at,
                   pp.accepted_at
            FROM participant_programs pp
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
            WHERE pp.participant_id = ? AND pp.certificate_issued = true
            ORDER BY p.name ASC`,
      args: [session.cid],
    });

    return NextResponse.json({ success: true, certificates: res.rows });
  } catch (error) {
    console.error("[participant certificates] error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
