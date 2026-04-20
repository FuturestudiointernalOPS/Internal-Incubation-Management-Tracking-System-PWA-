import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const { title, description, url, fileName } = await req.json();

    if (!title || !url) {
      return NextResponse.json({ success: false, error: "Title and Document URL are required." }, { status: 400 });
    }

    const { lastInsertRowid } = await db.execute({
      sql: "INSERT INTO v2_knowledge_bank (title, description, url, fileName) VALUES (?, ?, ?, ?)",
      args: [title, description, url, fileName]
    });

    return NextResponse.json({ success: true, id: lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    const { rows } = await db.execute("SELECT * FROM v2_knowledge_bank ORDER BY timestamp DESC");
    return NextResponse.json({ success: true, conceptNotes: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();
    await db.execute({
      sql: "DELETE FROM v2_knowledge_bank WHERE id = ?",
      args: [id]
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
