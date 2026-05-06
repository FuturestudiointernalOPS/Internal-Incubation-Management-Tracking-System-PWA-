import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get('cid');

    if (!cid) return NextResponse.json({ success: false, error: "Participant CID required" });

    // 1. Get Participant Info and their assigned Program/Team
    let contactRes = await db.execute({
      sql: `SELECT c.*, p.id as assigned_program_id, p.name as program_name, t.id as team_id, t.name as team_name 
            FROM contacts c
            LEFT JOIN v2_programs p ON c.group_name = p.name OR c.group_name = p.id
            LEFT JOIN v2_teams t ON (t.group_name = c.group_name AND t.id IN (SELECT team_id FROM v2_program_staff WHERE staff_id = c.cid))
            WHERE c.cid = ? LIMIT 1`,
      args: [cid]
    });

    let participant = contactRes.rows[0];
    let isEntity = false;

    if (!participant) {
       // Check if it's a Family/Company login
       const familyRes = await db.execute({
          sql: `SELECT f.*, p.id as assigned_program_id, p.name as program_name
                FROM families f
                LEFT JOIN v2_programs p ON f.program_id = p.id
                WHERE f.registration_id = ? LIMIT 1`,
          args: [cid]
       });
       if (familyRes.rows.length > 0) {
          const f = familyRes.rows[0];
          participant = {
             cid: f.registration_id,
             name: f.name,
             email: f.shared_email,
             group_name: f.name,
             role: 'participant',
             assigned_program_id: f.assigned_program_id,
             program_name: f.program_name
          };
          isEntity = true;
       }
    }

    if (!participant) return NextResponse.json({ success: false, error: "Participant not found" });


    const programId = participant.assigned_program_id;

    // 2. Parallel Cluster Fetch for scoped data
    const [subRes, sesRes, notRes, kpiRes, docRes, folRes] = await Promise.all([
      db.execute({ 
        sql: "SELECT s.*, ses.title as session_title FROM v2_submissions s LEFT JOIN v2_sessions ses ON s.requirement_id = ses.id WHERE s.participant_id = ? OR s.team_id = ? ORDER BY s.submitted_at DESC", 
        args: [cid, participant.team_id || 'NONE'] 
      }),
      db.execute({ 
        sql: "SELECT * FROM v2_sessions WHERE program_id = ? OR program_id = ? ORDER BY week_number ASC, created_at ASC", 
        args: [programId, participant.group_name] 
      }),
      db.execute({ 
        sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? OR recipient_id = 'ALL' ORDER BY created_at DESC LIMIT 20", 
        args: [cid] 
      }),
      db.execute({ 
        sql: "SELECT * FROM v2_kpis WHERE program_id = ?", 
        args: [programId] 
      }),
      db.execute({ 
        sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?", 
        args: [programId] 
      }),
      db.execute({ 
        sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 10", 
        args: [programId] 
      })
    ]);

    return NextResponse.json({
      success: true,
      participant: {
        cid: participant.cid,
        name: participant.name,
        email: participant.email,
        role: participant.role,
        group_name: participant.group_name,
        team_id: participant.team_id,
        team_name: participant.team_name
      },
      program: {
        id: programId,
        name: participant.program_name
      },
      submissions: subRes.rows,
      sessions: sesRes.rows,
      notifications: notRes.rows,
      kpis: kpiRes.rows,
      documents: docRes.rows,
      followups: folRes.rows
    });
  } catch (error) {
    console.error("Participant Full-State Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

