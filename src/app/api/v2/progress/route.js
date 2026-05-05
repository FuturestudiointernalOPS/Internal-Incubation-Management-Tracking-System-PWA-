import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get('program_id');
    const group_id = searchParams.get('group_id');
    const participant_id = searchParams.get('participant_id');

    if (!program_id) {
       return NextResponse.json({ success: false, error: "Program ID required" }, { status: 400 });
    }

    // 1. Fetch total deliverables
    const delResult = await db.execute({
       sql: "SELECT COUNT(*) as count FROM v2_deliverables WHERE program_id = ?",
       args: [program_id]
    });
    const totalDeliverables = delResult.rows[0].count || 0;

    // 2. Fetch approved submissions
    let subSql = "SELECT COUNT(*) as count FROM v2_submissions WHERE program_id = ? AND status = 'approved'";
    let subArgs = [program_id];

    if (group_id) {
       subSql += " AND group_id = ?";
       subArgs.push(group_id);
    } else if (participant_id) {
       subSql += " AND participant_id = ?";
       subArgs.push(participant_id);
    }

    const subResult = await db.execute({ sql: subSql, args: subArgs });
    const approvedCount = subResult.rows[0].count || 0;

    // 3. Current week (simplified: max week of approved + 1)
    const weekResult = await db.execute({
       sql: `SELECT MAX(d.week_number) as max_week 
             FROM v2_deliverables d
             JOIN v2_submissions s ON d.id = s.deliverable_id
             WHERE s.program_id = ? AND s.status = 'approved'
             ${group_id ? "AND s.group_id = ?" : participant_id ? "AND s.participant_id = ?" : ""}`,
       args: group_id ? [program_id, group_id] : participant_id ? [program_id, participant_id] : [program_id]
    });
    
    const currentWeek = (weekResult.rows[0].max_week || 0) + 1;
    const percentComplete = totalDeliverables > 0 ? Math.round((approvedCount / totalDeliverables) * 100) : 0;

    return NextResponse.json({
       success: true,
       metrics: {
          percentComplete,
          currentWeek,
          approvedCount,
          totalDeliverables
       }
    });
  } catch (error) {
    console.error("Progress Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
