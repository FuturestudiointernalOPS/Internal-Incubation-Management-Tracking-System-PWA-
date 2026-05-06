import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    await initDb();
    const result = await db.execute("SELECT * FROM families ORDER BY is_archived ASC, name ASC");
    return NextResponse.json({ success: true, families: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { name, program_id, type } = await req.json();
    if (!name) return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });

    const registration_id = "R-" + uuidv4().split('-')[0].toUpperCase();

    await db.execute({
      sql: "INSERT INTO families (name, registration_id, program_id, type) VALUES (?, ?, ?, ?)",
      args: [name, registration_id, program_id || null, type || 'individual']
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { id, name, program_id, type, shared_email, shared_password_read, shared_password_edit } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });

    await db.execute({
      sql: "UPDATE families SET name = ?, program_id = ?, type = ?, shared_email = ?, shared_password_read = ?, shared_password_edit = ? WHERE id = ?",
      args: [
        name, 
        program_id || null, 
        type || 'individual',
        shared_email || null,
        shared_password_read || null,
        shared_password_edit || null,
        id
      ]
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


export async function PATCH(req) {
  try {
    await initDb();
    const { id, is_archived } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });

    await db.execute({
      sql: "UPDATE families SET is_archived = ? WHERE id = ?",
      args: [is_archived ? 1 : 0, id]
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });

    await db.execute({
      sql: "DELETE FROM families WHERE id = ?",
      args: [id]
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

