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

    // B15: read from both families (used by program creation) and v2_groups
    let allGroups = [];

    // Query families table
    try {
      let famSql = "SELECT CAST(f.id AS TEXT) as id, f.program_id, f.name, f.description as project_description, f.lead_facilitator_id, c.name as lead_facilitator_name, f.created_at FROM families f LEFT JOIN contacts c ON f.lead_facilitator_id = c.cid";
      let famArgs = [];
      if (program_id) {
        famSql += " WHERE f.program_id = ?";
        famArgs.push(program_id);
      }
      const famRes = await db.execute({ sql: famSql, args: famArgs });
      allGroups.push(...famRes.rows.map(r => ({ ...r, source: 'family' })));
    } catch (_) {}

    // Query v2_groups table
    try {
      let v2Sql = "SELECT CAST(id AS TEXT) as id, program_id, name, project_description, created_at FROM v2_groups";
      let v2Args = [];
      if (program_id) {
        v2Sql += " WHERE program_id = ?";
        v2Args.push(program_id);
      }
      const v2Res = await db.execute({ sql: v2Sql, args: v2Args });
      allGroups.push(...v2Res.rows.map(r => ({ ...r, source: 'v2_group' })));
    } catch (_) {}

    allGroups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return NextResponse.json({ success: true, groups: allGroups });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
