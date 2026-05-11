import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * ENHANCED REPORTING V2 ENGINE (SAFE MODE)
 * Handles Weekly Stand-ups and Retros with continuity logic.
 */

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');

    if (!userId) return NextResponse.json({ success: false, error: "Identity required." }, { status: 400 });

    // 1. Determine Current Week (Monday as start)
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4); // Friday
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];

    // 2. Fetch existing reports for this week
    const reportRes = await db.execute({
      sql: "SELECT * FROM reports_v2 WHERE user_id = ? AND week_start = ?",
      args: [userId, weekStartStr]
    });

    const reports = reportRes.rows;
    
    // 3. If no report exists, provide a "Pre-flight" check for carry-over
    let carryOver = [];
    if (reports.length === 0) {
      // Find previous week's retro
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];

      const prevRetro = await db.execute({
        sql: `SELECT b.retro_status 
              FROM report_blocks_v2 b
              JOIN reports_v2 r ON b.report_id = r.id
              WHERE r.user_id = ? AND r.week_start = ? AND r.type = 'retro' AND r.status = 'submitted'`,
        args: [userId, prevWeekStartStr]
      });

      if (prevRetro.rows.length > 0) {
        prevRetro.rows.forEach(block => {
          const tasks = typeof block.retro_status === 'string' ? JSON.parse(block.retro_status) : block.retro_status;
          const pending = tasks.filter(t => !t.completed).map(t => t.task);
          carryOver = [...new Set([...carryOver, ...pending])];
        });
      }
    }

    return NextResponse.json({
      success: true,
      week_start: weekStartStr,
      week_end: weekEnd.toISOString().split('T')[0],
      reports,
      carry_over: carryOver
    });

  } catch (error) {
    console.error("V2 Reports Fetch Error:", error);
    return NextResponse.json({ success: false, error: "System Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { user_id, type, week_start, week_end, blocks } = body;

    // Validation
    if (!user_id || !type || !week_start || !blocks) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // 1. Transactional Write (Simplified for this execution)
    // Create the meta report
    const reportResult = await db.execute({
      sql: `INSERT INTO reports_v2 (user_id, week_start, week_end, type, status) 
            VALUES (?, ?, ?, ?, 'submitted') RETURNING id`,
      args: [user_id, week_start, week_end, type]
    });

    const reportId = reportResult.rows[0].id;

    // 2. Create Blocks
    for (const block of blocks) {
      await db.execute({
        sql: `INSERT INTO report_blocks_v2 (
                report_id, context_type, program_id, current_state, challenge, 
                todo, retro_status, what_worked, what_failed, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          reportId, 
          block.context_type, 
          block.program_id || null,
          block.current_state || null,
          block.challenge || null,
          JSON.stringify(block.todo || []),
          JSON.stringify(block.retro_status || []),
          block.what_worked || null,
          block.what_failed || null,
          block.notes || null
        ]
      });
    }

    // 3. Log Activity
    await db.execute({
      sql: "INSERT INTO activity_logs (user, action, module, status) VALUES (?, ?, ?, ?)",
      args: [user_id, `Submitted V2 ${type}`, 'Reporting', 'success']
    });

    return NextResponse.json({ success: true, report_id: reportId });

  } catch (error) {
    console.error("V2 Reports Submit Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
