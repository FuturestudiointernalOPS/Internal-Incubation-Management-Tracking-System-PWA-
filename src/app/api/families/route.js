import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    await initDb();
    const result = await db.execute("SELECT * FROM families ORDER BY name ASC");
    return NextResponse.json({ success: true, families: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { name, program_id } = await req.json();
    if (!name) return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });

    const registration_id = "R-" + uuidv4().split('-')[0].toUpperCase();

    await db.execute({
      sql: "INSERT INTO families (name, registration_id, program_id) VALUES (?, ?, ?)",
      args: [name, registration_id, program_id || null]
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { id, email, password } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });

    await db.execute({
      sql: "UPDATE families SET email = ?, password = ? WHERE id = ?",
      args: [email, password, id]
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
