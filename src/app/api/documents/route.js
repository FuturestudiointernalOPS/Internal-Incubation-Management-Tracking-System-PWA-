import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const result = await db.execute({
      sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
      args: [programId],
    });
    return NextResponse.json({ success: true, documents: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { program_id, title, description } = await req.json();
    const result = await db.execute({
      sql: "INSERT INTO v2_document_requirements (program_id, title, description) VALUES (?, ?, ?) RETURNING *",
      args: [program_id, title, description],
    });
    return NextResponse.json({ success: true, document: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
