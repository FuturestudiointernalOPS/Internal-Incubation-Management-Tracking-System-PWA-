import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createProgramTypeOption,
  createProgramTypeOptionsTable,
  listProgramTypeKeys,
} from "@/models/programs";

/**
 * GET /api/program-types — Returns all custom program types
 * POST /api/program-types — Adds a new custom program type
 */
export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;
  try {
    await initDb();
    // Read-only: creating the table is a WRITE and belongs to POST (and to
    // initDb). A GET must not run DDL.
    const result = await listProgramTypeKeys();
    return NextResponse.json({ types: result.rows.map((row) => row.type_key) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    await initDb();
    await createProgramTypeOptionsTable();
    const { type_key } = await req.json();
    if (!type_key) {
      return NextResponse.json({ error: "type_key is required" }, { status: 400 });
    }
    await createProgramTypeOption(type_key);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
