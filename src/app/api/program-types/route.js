import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAnyAuthorization } from "@/models/authorization/index";
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
  // A creator needs it too, so the creation right is an accepted alternative.
  const capError = await requireAnyAuthorization([
    { module: "programs", capability: "view" },
    { module: "programs", capability: "create" },
  ]);
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
    // Extending the program vocabulary is a platform-setting operation — or part
    // of creating a program, for a delegated creator.
    const capError = await requireAnyAuthorization([
      { module: "settings", capability: "edit" },
      { module: "programs", capability: "create" },
    ]);
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
