import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { 
       program_id, deliverable_id, group_id, participant_id, 
       submission_link, file_path, status, feedback 
    } = body;

    if (!program_id || !deliverable_id) {
       return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { lastInsertRowid } = await db.execute({
       sql: `INSERT INTO v2_submissions (
          program_id, deliverable_id, group_id, participant_id, 
          submission_link, file_path, status, feedback
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
       args: [
          program_id, deliverable_id, group_id || null, participant_id || null, 
          submission_link || null, file_path || null, status || 'pending', feedback || null
       ]
    });

    return NextResponse.json({ 
       success: true, 
       submission: { id: Number(lastInsertRowid), program_id, deliverable_id, status: status || 'pending' } 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
     await initDb();
     const { id, status, feedback } = await req.json();

     if (!id || !status) {
        return NextResponse.json({ success: false, error: "Missing ID or status" }, { status: 400 });
     }

     await db.execute({
        sql: "UPDATE v2_submissions SET status = ?, feedback = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [status, feedback || null, id]
     });

     return NextResponse.json({ success: true });
  } catch (error) {
     return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const participant_id = searchParams.get('participant_id');
    const group_id = searchParams.get('group_id');
    const program_id = searchParams.get('program_id');
    const status = searchParams.get('status');

    let sql = `
       SELECT s.*, d.title as deliverable_title, d.week_number as deliverable_week,
              p.name as participant_name, g.name as group_name
       FROM v2_submissions s
       LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id
       LEFT JOIN v2_participants p ON s.participant_id = p.id
       LEFT JOIN v2_groups g ON s.group_id = g.id
       WHERE 1=1
    `;
    let args = [];
    
    if (participant_id) {
       sql += " AND s.participant_id = ?";
       args.push(participant_id);
    }
    if (group_id) {
       sql += " AND s.group_id = ?";
       args.push(group_id);
    }
    if (program_id) {
       sql += " AND s.program_id = ?";
       args.push(program_id);
    }
    if (status) {
       sql += " AND s.status = ?";
       args.push(status);
    }
    
    sql += " ORDER BY s.created_at DESC";

    const { rows } = await db.execute({ sql, args });

    // Format for UI (mimic supabase join structure)
    const submissions = rows.map(r => ({
       ...r,
       v2_deliverables: { title: r.deliverable_title, week_number: r.deliverable_week },
       v2_participants: r.participant_name ? { name: r.participant_name } : null,
       v2_groups: r.group_name ? { name: r.group_name } : null
    }));

    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    console.error("Submissions GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
