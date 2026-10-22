import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { serverError } from "@/lib/apiError";
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
  // The list feeds the program form: reading it is reading program vocabulary.
  const capError = await requireAuthorization("programs", "view");
  if (capError) return capError;
  try {
    await initDb();
    // Read-only: creating the table is a WRITE and belongs to POST (and to
    // initDb). A GET must not run DDL.
    const result = await listProgramTypeKeys();
    return NextResponse.json({ types: result.rows.map((row) => row.type_key) });
  } catch (error) {
    return serverError(error, { log: "program-types GET" });
  }
}

export async function POST(req) {
  try {
    // Extending the program vocabulary is a platform-setting operation.
    const capError = await requireAuthorization("settings", "edit");
    if (capError) return capError;
    await initDb();
    await createProgramTypeOptionsTable();
    const { type_key } = await req.json();
    if (!type_key) {
      return NextResponse.json({ error: "type_key is required" }, { status: 400 });
    }
    await createProgramTypeOption(type_key);
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, { log: "program-types POST" });
  }
}
