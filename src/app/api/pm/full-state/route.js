import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, error: "ID required" });

    // Parallel Database Execution on the EDGE/Cloud
    const [progRes, parRes, teamRes, sesRes, staffRes, eventRes, kpiRes, docRes, folRes, assignedStaffRes, subRes, repRes, famRes] = await Promise.all([
      db.execute({ 
        sql: `SELECT p.*, 
                     k.title as note_title, k.url as note_files, k.description as note_description,
                     c.name as pm_name,
                     NULL as completion_index
              FROM v2_programs p 
              LEFT JOIN v2_knowledge_bank k ON CAST(p.note_id AS TEXT) = CAST(k.id AS TEXT) 
              LEFT JOIN contacts c ON p.assigned_pm_id = c.cid
              WHERE p.id = ?`, 
        args: [id] 
      }),
      db.execute({ 
        sql: `
          SELECT CAST(id AS TEXT) as id, program_id, name, email, phone, screening_status, created_at, 'MANUAL' as group_name, 'manual' as source, v2_team_id
          FROM v2_participants 
          WHERE program_id = ?
          
          UNION
          
          -- Self-Healing Join: Matches contacts via Family Link
          SELECT CAST(c.cid AS TEXT) as id, f.program_id, c.name, c.email, c.phone, 'approved' as screening_status, c.created_at, c.group_name, 'group' as source, c.v2_team_id
          FROM contacts c
          JOIN families f ON UPPER(TRIM(c.group_name)) = UPPER(TRIM(f.name))
          WHERE f.program_id = ?
          
          UNION
          
          -- Direct Profile Link: Matches contacts with program_id in their profile
          SELECT CAST(cid AS TEXT) as id, program_id, name, email, phone, 'approved' as screening_status, created_at, group_name, 'direct' as source, v2_team_id
          FROM contacts
          WHERE program_id = ?
 
          UNION
 
          -- Ultimate Link-Fallback: Matches any contact whose group name is assigned to this program
          SELECT CAST(cid AS TEXT) as id, ? as program_id, name, email, phone, 'approved' as screening_status, created_at, group_name, 'link-fallback' as source, v2_team_id
          FROM contacts
          WHERE UPPER(TRIM(group_name)) IN (
            SELECT UPPER(TRIM(name)) FROM families WHERE program_id = ?
          )
        `, 
        args: [id, id, id, id, id] 
      }),
      db.execute({ sql: "SELECT * FROM v2_teams WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_sessions WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT cid, name, email, phone, role FROM contacts WHERE role IN ('teacher', 'staff', 'admin') AND deleted = 0", args: [] }),
      db.execute({ sql: "SELECT * FROM v2_events WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_kpis WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC", args: [id] }),
      db.execute({ 
        sql: `SELECT ps.id, c.cid, c.name, c.email, ps.role 
              FROM v2_program_staff ps 
              JOIN contacts c ON ps.staff_id = c.cid 
              WHERE ps.program_id = ?`, 
        args: [id] 
      }),
      db.execute({ sql: "SELECT * FROM v2_submissions WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_weekly_reports WHERE program_id = ? ORDER BY week_number DESC", args: [id] }),
      db.execute({ sql: "SELECT * FROM families WHERE program_id = ?", args: [id] })
    ]);

    const program = progRes.rows[0];
    if (program) {
      try {
        program.materials = typeof program.materials === 'string' ? JSON.parse(program.materials || '[]') : (program.materials || []);
        
        // Fetch new Multi-PDF attachments for the linked Knowledge Note with explicit ID casting
        if (program.note_id) {
           const kbAttachmentsRes = await db.execute({
             sql: "SELECT name, url FROM v2_knowledge_attachments WHERE CAST(note_id AS TEXT) = CAST(? AS TEXT)",
             args: [program.note_id]
           });
           program.knowledge_assets = kbAttachmentsRes.rows;
        } else {
           program.knowledge_assets = [];
        }

        // --- DYNAMIC PROGRESS CALCULATION (OFFLOADED FROM SQL) ---
        const sessions = sesRes.rows || [];
        const documents = docRes.rows || [];
        const reports = repRes.rows || [];
        
        const totalSessions = sessions.length;
        const completedSessions = sessions.filter(s => s.status === 'completed').length;
        const totalDocs = documents.length;
        const completedDocs = documents.filter(d => d.is_completed).length;
        const uniqueReportWeeks = new Set(reports.map(r => r.week_number)).size;
        
        const totalPoints = (totalSessions * 5.0) + (totalDocs * 2.0) + ((program.duration_weeks || 13) * 10.0);
        const completedPoints = (completedSessions * 5.0) + (completedDocs * 2.0) + (uniqueReportWeeks * 10.0);
        
        program.completion_index = totalPoints > 0 ? (completedPoints / totalPoints) * 100.0 : 0;
        
      } catch (e) {
        program.materials = [];
        program.knowledge_assets = [];
        program.completion_index = 0;
      }
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

    // HARDENED DE-DUPLICATION: Ensure participants are unique by email for metrics integrity
    const uniqueParticipants = Array.from(
      new Map(parRes.rows.map(p => [p.email.toLowerCase(), p])).values()
    );

    return NextResponse.json({
      success: true,
      program: program,
      participants: uniqueParticipants,
      teams: teamRes.rows,
      sessions: sesRes.rows,
      staffList: staffRes.rows,
      events: eventRes.rows,
      kpis: kpiRes.rows,
      documents: docRes.rows,
      followups: folRes.rows,
      assignedStaff: assignedStaff,
      submissions: subRes.rows,
      reports: repRes.rows,
      families: famRes.rows
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
