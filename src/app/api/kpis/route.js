import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('program_id');
    const result = await db.execute({
      sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
      args: [programId]
    });
    return NextResponse.json({ success: true, kpis: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { program_id, title, target_value } = await req.json();
    const result = await db.execute({
      sql: "INSERT INTO v2_kpis (program_id, title, target_value) VALUES (?, ?, ?) RETURNING id, title, target_value",
      args: [program_id, title, target_value]
    });
    return NextResponse.json({ success: true, kpi: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { id, title, target_value } = await req.json();
    await db.execute({
      sql: "UPDATE v2_kpis SET title = ?, target_value = ? WHERE id = ?",
      args: [title, target_value, id]
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
    await db.execute({
      sql: "DELETE FROM v2_kpis WHERE id = ?",
      args: [id]
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
