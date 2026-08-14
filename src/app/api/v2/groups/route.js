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
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;
    const body = await req.json();
    const { program_id, name, project_description, type } = body;

    if (!program_id || !name) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // System group protection: 'Facilitators' is a system-defined group —
    // only one per program, never duplicated, never downgraded.
    const isFacilitatorsGroup = name.trim().toUpperCase() === "FACILITATORS";
    if (isFacilitatorsGroup) {
      const dup = await db.execute({
        sql: "SELECT id FROM v2_groups WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'",
        args: [program_id],
      });
      if (dup.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: "The Facilitators group already exists for this program and is system-protected." },
          { status: 409 },
        );
      }
    }

    const result = await db.execute({
      sql: `INSERT INTO v2_groups (program_id, name, project_description, type, is_system)
             VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [
        program_id,
        name,
        project_description || null,
        isFacilitatorsGroup ? "facilitators" : type || "participant",
        isFacilitatorsGroup ? 1 : 0,
      ],
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

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;
    const body = await req.json();
    const { id, name, project_description, demo_link, resources_link, pitch_deck_url } = body;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // System groups (e.g. Facilitators) cannot be renamed, retyped, or deleted
    const existing = await db.execute({
      sql: "SELECT name, type, is_system FROM v2_groups WHERE CAST(id AS TEXT) = ?",
      args: [String(id)],
    });
    const row = existing.rows[0];
    if (row && Number(row.is_system) === 1 && name !== undefined && name.trim() !== row.name) {
      return NextResponse.json(
        { success: false, error: "This is a system-defined group and cannot be renamed." },
        { status: 403 },
      );
    }

    const fields = [];
    const args = [];
    if (name !== undefined) { fields.push("name = ?"); args.push(name); }
    if (project_description !== undefined) { fields.push("project_description = ?"); args.push(project_description); }
    if (demo_link !== undefined) { fields.push("demo_link = ?"); args.push(demo_link); }
    if (resources_link !== undefined) { fields.push("resources_link = ?"); args.push(resources_link); }
    if (pitch_deck_url !== undefined) { fields.push("pitch_deck_url = ?"); args.push(pitch_deck_url); }
    if (fields.length === 0) {
      return NextResponse.json({ success: true, message: "No fields to update." });
    }
    args.push(id);
    await db.execute({
      sql: `UPDATE v2_groups SET ${fields.join(", ")} WHERE CAST(id AS TEXT) = ?`,
      args,
    });
    return NextResponse.json({ success: true });
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
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    // B15: read from both families (used by program creation) and v2_groups
    let allGroups = [];

    // Query families table
    try {
      let famSql = "SELECT CAST(f.id AS TEXT) as id, f.program_id, f.name, f.description as project_description, f.lead_facilitator_id, c.name as lead_facilitator_name, 'participant' as type, 0 as is_system, f.created_at FROM families f LEFT JOIN contacts c ON f.lead_facilitator_id = c.cid";
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
      let v2Sql = "SELECT CAST(id AS TEXT) as id, program_id, name, project_description, type, is_system, created_at FROM v2_groups";
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
