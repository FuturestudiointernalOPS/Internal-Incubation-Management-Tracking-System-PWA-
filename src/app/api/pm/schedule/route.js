import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const pmId = searchParams.get('pm_id');

    // Fetch sessions based on role and identity
    let sessions;
    if (searchParams.get('is_super_admin') === 'true') {
      // FULL CALENDAR for Super Admin
      sessions = await db.execute({
        sql: `
           SELECT s.*, p.name as program_name 
           FROM v2_sessions s
           JOIN v2_programs p ON s.program_id = p.id
           WHERE s.scheduled_date IS NOT NULL AND p.is_archived = 0
           ORDER BY s.scheduled_date ASC
        `,
        args: []
      });
    } else if (searchParams.get('teacher_id')) {
      // TEACHER SPECIFIC schedule
      sessions = await db.execute({
        sql: `
           SELECT s.*, p.name as program_name 
           FROM v2_sessions s
           JOIN v2_programs p ON s.program_id = p.id
           WHERE s.handler_id = ? AND s.scheduled_date IS NOT NULL AND p.is_archived = 0
           ORDER BY s.scheduled_date ASC
        `,
        args: [searchParams.get('teacher_id')]
      });
    } else {
      // PM / TEAM MEMBER schedule
      if (!pmId) {
        return NextResponse.json({ success: false, error: "Identity required." }, { status: 400 });
      }

      const isLeadPM = searchParams.get('is_lead_pm') === 'true';

      if (isLeadPM) {
        // FULL OVERSIGHT for Lead PMs
        sessions = await db.execute({
          sql: `
             SELECT s.*, p.name as program_name 
             FROM v2_sessions s
             JOIN v2_programs p ON s.program_id = p.id
             WHERE p.assigned_pm_id = ? AND s.scheduled_date IS NOT NULL AND p.is_archived = 0
             ORDER BY s.scheduled_date ASC
          `,
          args: [pmId]
        });
      } else {
        // PERSONAL TIMELINE for Team Members
        sessions = await db.execute({
          sql: `
             SELECT s.*, p.name as program_name 
             FROM v2_sessions s
             JOIN v2_programs p ON s.program_id = p.id
             WHERE s.handler_id = ? AND s.scheduled_date IS NOT NULL AND p.is_archived = 0
             ORDER BY s.scheduled_date ASC
          `,
          args: [pmId]
        });
      }
    }

    return NextResponse.json({
      success: true,
      schedule: sessions.rows
    });

  } catch (error) {
    console.error("Schedule Fetch Error:", error);
    return NextResponse.json({ success: false, error: "System Error" }, { status: 500 });
  }
}
