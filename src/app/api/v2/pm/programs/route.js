import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

export async function GET(req) {
  try {
    await initDb();
    const url = new URL(req.url);
    const assignedPmId = url.searchParams.get('assigned_pm_id');

    let query = `
      SELECT p.*, 
             c1.name as pm_name, 
             c2.name as assistant_name,
             k.title as note_title,
             (SELECT COUNT(*) FROM v2_sessions WHERE program_id = p.id) as sessions_count,
             (SELECT COUNT(*) FROM v2_participants WHERE program_id = p.id) as participants_count,
             (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id) as docs_total,
             (SELECT COUNT(*) FROM v2_document_requirements WHERE program_id = p.id AND is_completed = 1) as docs_completed,
             (SELECT COUNT(*) FROM v2_weekly_reports WHERE program_id = p.id) as reports_count,
             (SELECT 
                ( (COUNT(CASE WHEN s.status = 'completed' THEN 1 END) * 5.0) + 
                  (IFNULL((SELECT SUM(is_completed) * 2.0 FROM v2_document_requirements WHERE program_id = p.id), 0)) +
                  (IFNULL((SELECT COUNT(DISTINCT week_number) * 10.0 FROM v2_weekly_reports WHERE program_id = p.id), 0))
                ) / 
                ( (COUNT(s.id) * 5.0 + IFNULL((SELECT COUNT(*) * 2.0 FROM v2_document_requirements WHERE program_id = p.id), 0)) + (p.duration_weeks * 10.0) + 0.0001
                ) * 100.0
              FROM v2_sessions s WHERE s.program_id = p.id
             ) as completion_index
      FROM v2_programs p
      LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
      LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
      LEFT JOIN v2_knowledge_bank k ON p.note_id = k.id
      WHERE p.is_archived = 0
    `;
    
    const args = [];
    if (assignedPmId) {
       query += " AND p.assigned_pm_id = ?";
       args.push(assignedPmId);
    }

    query += " ORDER BY p.created_at DESC";

    const programs = await db.execute({
      sql: query,
      args: args
    });
    
    return NextResponse.json({ success: true, programs: programs.rows });
  } catch (error) {
    console.error("GET Programs Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { name, description, note_id, assigned_pm_id, assigned_assistant_id, materials } = await req.json();
    const id = "P-" + new Date().getFullYear() + "-" + uuidv4().split('-')[0].toUpperCase();

    await db.execute({
      sql: `INSERT INTO v2_programs (id, name, description, note_id, assigned_pm_id, assigned_assistant_id, status, is_archived, materials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, name, description, note_id || null, assigned_pm_id || null, assigned_assistant_id || null, 'active', 0, JSON.stringify(materials || [])]
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { id, name, description, note_id, assigned_pm_id, assigned_assistant_id, status, materials } = await req.json();

    if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

    await db.execute({
      sql: `UPDATE v2_programs 
            SET name = ?, description = ?, note_id = ?, assigned_pm_id = ?, assigned_assistant_id = ?, status = ?, materials = ?
            WHERE id = ?`,
      args: [name, description, note_id || null, assigned_pm_id || null, assigned_assistant_id || null, status, JSON.stringify(materials || []), id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const { id, is_archived, action } = await req.json();

    if (action === 'archive') {
      await db.execute({
        sql: "UPDATE v2_programs SET is_archived = ? WHERE id = ?",
        args: [is_archived ? 1 : 0, id]
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();

    if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

    await db.execute({
      sql: "DELETE FROM v2_programs WHERE id = ?",
      args: [id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
