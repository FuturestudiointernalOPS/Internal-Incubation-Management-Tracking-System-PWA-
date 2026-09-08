import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createProgramTypeOption,
  createProgramTypeOptionsTable,
  ensureProgramTypeOptionsTable,
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
    await ensureProgramTypeOptionsTable();
    const result = await listProgramTypeKeys();
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
