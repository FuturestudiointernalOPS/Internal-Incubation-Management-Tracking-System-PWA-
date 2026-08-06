import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    if (!a || !b) return NextResponse.json({ success: false, error: "a and b required" }, { status: 400 });

    // Count what will be reassigned
    const [ppCount, vmCount, tlCount] = await Promise.all([
      db.execute({ sql: "SELECT COUNT(*)::int AS c FROM participant_programs WHERE participant_id = ?", args: [b] }),
      db.execute({ sql: "SELECT COUNT(*)::int AS c FROM venture_members WHERE contact_id = ? AND removed_at IS NULL", args: [b] }),
      db.execute({ sql: "SELECT COUNT(*)::int AS c FROM contact_timeline WHERE contact_cid = ?", args: [b] }),
    ]);

    return NextResponse.json({
      success: true,
      summary: {
        program_enrollments: ppCount.rows[0]?.c || 0,
        venture_memberships: vmCount.rows[0]?.c || 0,
        timeline_events: tlCount.rows[0]?.c || 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
