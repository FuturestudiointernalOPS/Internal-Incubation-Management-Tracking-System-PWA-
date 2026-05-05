import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();

    // High-Efficiency Global Rollup
    const [progRes, projRes, partRes, staffRes, logRes, activeProgList] = await Promise.all([
      db.execute("SELECT COUNT(*) as count FROM v2_programs WHERE is_archived = 0"),
      db.execute("SELECT COUNT(*) as count FROM v2_projects"),
      db.execute("SELECT COUNT(*) as count FROM v2_participants"),
      db.execute("SELECT COUNT(*) as count FROM contacts WHERE role IN ('admin', 'staff', 'teacher')"),
      db.execute("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 10"),
      db.execute("SELECT id, name, status, created_at FROM v2_programs WHERE is_archived = 0 ORDER BY created_at DESC LIMIT 5")
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        programs: progRes.rows[0].count,
        projects: projRes.rows[0].count,
        participants: partRes.rows[0].count,
        totalStaff: staffRes.rows[0].count
      },
      activity: logRes.rows,
      activePrograms: activeProgList.rows
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
