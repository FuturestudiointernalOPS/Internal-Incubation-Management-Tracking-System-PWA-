// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff"]);
    if (authError) return authError;
    const body = await req.json();
    const { program_id, name, project_description } = body;

    if (!program_id || !name) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO v2_groups (program_id, name, project_description)
             VALUES (?, ?, ?) RETURNING id`,
      args: [program_id, name, project_description || null],
    });

    return NextResponse.json({
      success: true,
      group: {
        id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
        program_id,
        name,
        project_description,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    let sql = "SELECT * FROM v2_groups";
    let args = [];

    if (program_id) {
      sql += " WHERE program_id = ?";
      args.push(program_id);
    }

    sql += " ORDER BY created_at DESC";

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, groups: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
