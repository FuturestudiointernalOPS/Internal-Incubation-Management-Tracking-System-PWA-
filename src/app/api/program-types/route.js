import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/program-types — Returns all custom program types
 * POST /api/program-types — Adds a new custom program type
 */
export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    await initDb();
    await db.execute(
      "CREATE TABLE IF NOT EXISTS program_type_options (id SERIAL PRIMARY KEY, type_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    );
    const result = await db.execute({
      sql: "SELECT type_key FROM program_type_options ORDER BY created_at ASC",
      args: [],
    });
    return NextResponse.json({ types: result.rows.map((r) => r.type_key) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "developer"]);
    if (authError) return authError;
    await initDb();
    await db.execute(
      "CREATE TABLE IF NOT EXISTS program_type_options (id SERIAL PRIMARY KEY, type_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    );
    const { type_key } = await req.json();
    if (!type_key) {
      return NextResponse.json({ error: "type_key is required" }, { status: 400 });
    }
    await db.execute({
      sql: "INSERT INTO program_type_options (type_key, display_name) VALUES (?, ?) ON CONFLICT (type_key) DO NOTHING",
      args: [type_key, type_key.replace(/_/g, " ")],
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
