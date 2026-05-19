import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, error: "ID required" });

    // Parallel Database Execution on the EDGE/Cloud
    const queries = [
      { name: 'program', sql: `SELECT p.*, 
                     k.title as note_title, k.url as note_files, k.description as note_description,
                     c.name as pm_name,
                     (SELECT COUNT(*) FROM v2_sessions WHERE program_id = p.id) as sessions_count,
                     (SELECT COUNT(*) FROM v2_sessions WHERE program_id = p.id AND status = 'completed') as completed_sessions_count,
                     (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id) as docs_total,
                     (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id AND is_completed = 1) as docs_completed,
                     (SELECT COUNT(DISTINCT week_number) FROM v2_weekly_reports WHERE program_id = p.id) as reports_count
              FROM v2_programs p 
              LEFT JOIN v2_knowledge_bank k ON p.note_id = k.id 
              LEFT JOIN contacts c ON p.assigned_pm_id = c.cid
              WHERE p.id = ?`, args: [id] },
      { name: 'participants', sql: "SELECT * FROM v2_participants WHERE program_id = ?", args: [id] },
      { name: 'teams', sql: "SELECT * FROM v2_teams WHERE program_id = ?", args: [id] },
      { name: 'sessions', sql: "SELECT * FROM v2_sessions WHERE program_id = ?", args: [id] },
      { name: 'staffList', sql: "SELECT cid, name, email, phone, role FROM contacts WHERE role IN ('teacher', 'staff', 'admin') AND deleted = 0", args: [] },
      { name: 'events', sql: "SELECT * FROM v2_events WHERE program_id = ?", args: [id] },
      { name: 'kpis', sql: "SELECT * FROM v2_kpis WHERE program_id = ?", args: [id] },
      { name: 'documents', sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?", args: [id] },
      { name: 'followups', sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC", args: [id] },
      { name: 'assignedStaff', sql: `SELECT c.cid, c.name, c.email, ps.role FROM v2_program_staff ps JOIN contacts c ON ps.staff_id = c.cid WHERE ps.program_id = ?`, args: [id] },
      { name: 'submissions', sql: "SELECT * FROM v2_submissions WHERE program_id = ?", args: [id] },
      { name: 'groups', sql: "SELECT * FROM v2_groups WHERE program_id = ?", args: [id] }
    ];

    const results = await Promise.all(queries.map(async (q) => {
      try {
        return await db.execute({ sql: q.sql, args: q.args });
      } catch (e) {
        console.error(` forensic | Query [${q.name}] failed:`, e.message);
        return { rows: [] };
      }
    }));

    const [progRes, parRes, teamRes, sesRes, staffRes, eventRes, kpiRes, docRes, folRes, assignedStaffRes, subRes, groupRes] = results;

    const program = progRes.rows[0];
    if (program) {
      try {
        program.materials = JSON.parse(program.materials || '[]');
        program.note_files = JSON.parse(program.note_files || '[]');
      } catch (e) {
        program.materials = [];
        program.note_files = [];
      }
      
      // Calculate Completion Index in JS
      const totalPoints = (program.sessions_count * 5.0) + (program.docs_total * 2.0) + ((program.duration_weeks || 13) * 10.0);
      const completedPoints = (program.completed_sessions_count * 5.0) + (program.docs_completed * 2.0) + (program.reports_count * 10.0);
      program.completion_index = totalPoints > 0 ? (completedPoints / totalPoints) * 100.0 : 0;
    }

    // Capture "Assigned Team" from multiple sources
    let assignedStaff = assignedStaffRes.rows;
    
    // Check for "Legacy" or "Direct" assignments in program.assigned_assistant_id
    if (program?.assigned_assistant_id) {
       try {
          const assistantIds = JSON.parse(program.assigned_assistant_id);
          if (Array.isArray(assistantIds) && assistantIds.length > 0) {
             const assistantsRes = await db.execute({
                sql: `SELECT cid, name, email, phone, role FROM contacts WHERE cid IN (${assistantIds.map(() => '?').join(',')})`,
                args: assistantIds
             });
             // Merge and remove duplicates by cid
             const merged = [...assignedStaff, ...assistantsRes.rows];
             assignedStaff = Array.from(new Map(merged.map(item => [item.cid, item])).values());
          }
       } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      program: program,
      participants: parRes.rows,
      teams: teamRes.rows,
      sessions: sesRes.rows,
      staffList: staffRes.rows,
      events: eventRes.rows,
      kpis: kpiRes.rows,
      documents: docRes.rows,
      followups: folRes.rows,
      assignedStaff: assignedStaff,
      submissions: subRes.rows,
      groups: groupRes.rows
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
