import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    await initDb();
    const programs = await db.execute(`
      SELECT p.*, 
             c1.name as pm_name, 
             c2.name as assistant_name,
             k.title as note_title
      FROM v2_programs p
      LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
      LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
      LEFT JOIN v2_knowledge_bank k ON p.note_id = k.id
      ORDER BY p.created_at DESC
    `);
    return NextResponse.json({ success: true, programs: programs.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { name, description, note_id, assigned_pm_id, assigned_assistant_id } = await req.json();
    const id = uuidv4();

    await db.execute({
      sql: `INSERT INTO v2_programs (id, name, description, note_id, assigned_pm_id, assigned_assistant_id, status, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, name, description, note_id || null, assigned_pm_id || null, assigned_assistant_id || null, 'active', 0]
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { id, name, description, note_id, assigned_pm_id, assigned_assistant_id, status } = await req.json();

    if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

    await db.execute({
      sql: `UPDATE v2_programs 
            SET name = ?, description = ?, note_id = ?, assigned_pm_id = ?, assigned_assistant_id = ?, status = ?
            WHERE id = ?`,
      args: [name, description, note_id || null, assigned_pm_id || null, assigned_assistant_id || null, status, id]
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
