import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const data = await req.json();
    const { program_id, name, handler_id, handler_name } = data;

    if (!program_id || !name) {
      return NextResponse.json({ success: false, error: "Missing squad parameters." }, { status: 400 });
    }

    const result = await db.execute({
      sql: "INSERT INTO v2_teams (program_id, name, handler_id, handler_name) VALUES (?, ?, ?, ?)",
      args: [program_id, name, handler_id, handler_name]
    });

    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Team Creation Error:", error);
    return NextResponse.json({ success: false, error: "System Security Exception" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();
    await db.execute({
      sql: "DELETE FROM v2_teams WHERE id = ?",
      args: [id]
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
