import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * PROJECTS API
 *
 * GET   /api/projects?program_id=X&user_cid=X
 * POST  /api/projects
 * PUT   /api/projects
 *
 * Supports:
 * - Creating projects (POST)
 * - Editing projects, archiving (PUT)
 * - Fetching all projects or filtered by program or user assignment (GET)
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    const {
      program_id,
      name,
      status,
      type,
      description,
      concept_note,
      concept_note_url,
      assigned_pm_id,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Project name is required." },
        { status: 400 },
      );
    }

    // Build meta with all extra fields
    const meta = JSON.stringify({
      type: type || null,
      description: description || null,
      concept_note: concept_note || null,
      concept_note_url: concept_note_url || null,
      assigned_pm_id: assigned_pm_id || null,
    });

    const result = await db.execute({
      sql: "INSERT INTO v2_projects (program_id, name, status, meta, owner_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
      args: [
        program_id || null,
        name,
        status || "Active",
        meta,
        assigned_pm_id || null,
      ],
    });

    const projectId = result.rows[0]?.id || result.lastInsertRowid;

    // If a PM lead was assigned, add them as a project member with lead role
    if (assigned_pm_id) {
      await db.execute({
        sql: "INSERT INTO project_members (project_id, user_cid, role) VALUES (?, ?, 'lead') ON CONFLICT (project_id, user_cid) DO UPDATE SET role = 'lead'",
        args: [String(projectId), assigned_pm_id],
      });
    }

    return NextResponse.json({ success: true, project_id: projectId });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const user_cid = searchParams.get("user_cid");
    const include_archived = searchParams.get("include_archived");

    let query = `
      SELECT p.*, pr.name as program_name
      FROM v2_projects p
      LEFT JOIN v2_programs pr ON p.program_id::text = pr.id::text
    `;
    const conditions = [];
    const args = [];

    // Filter by program
    if (program_id) {
      conditions.push("p.program_id = ?");
      args.push(program_id);
    }

    // Filter by user membership (project_members is the authoritative source)
    if (user_cid) {
      conditions.push(
        "EXISTS (SELECT 1 FROM project_members WHERE project_id::text = p.id::text AND user_cid = ?)",
      );
      args.push(user_cid);
    }

    // Exclude archived unless explicitly requested
    if (include_archived !== "true") {
      conditions.push("p.status != 'Archived'");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY p.created_at DESC";

    const result = await db.execute({ sql: query, args });

    // Get all members in a single query instead of N+1
    const projectIds = result.rows.map((r) => r.id);
    let allMembers = [];
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => "?").join(",");
      const memberRes = await db.execute({
        sql: `SELECT project_id, user_cid, role FROM project_members WHERE project_id::text IN (${placeholders})`,
        args: projectIds,
      });
      allMembers = memberRes.rows || [];
    }

    // Group members by project_id
    const memberMap = {};
    for (const m of allMembers) {
      const pid = String(m.project_id);
      if (!memberMap[pid]) memberMap[pid] = [];
      memberMap[pid].push({ user_cid: m.user_cid, role: m.role });
    }

    // Parse meta JSON for each project
    const projects = result.rows.map((row) => {
      const meta = row.meta ? JSON.parse(row.meta) : {};
      return {
        ...row,
        meta,
        members: memberMap[String(row.id)] || [],
      };
    });

    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    const {
      id,
      name,
      status,
      type,
      description,
      concept_note,
      concept_note_url,
      assigned_pm_id,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Project ID is required." },
        { status: 400 },
      );
    }

    const updateFields = [];
    const updateArgs = [];

    if (name !== undefined) {
      updateFields.push("name = ?");
      updateArgs.push(name);
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      updateArgs.push(status);
    }

    // If meta fields changed, update the meta JSON
    if (
      type !== undefined ||
      description !== undefined ||
      concept_note !== undefined ||
      concept_note_url !== undefined ||
      assigned_pm_id !== undefined
    ) {
      // Fetch current meta
      const current = await db.execute({
        sql: "SELECT meta FROM v2_projects WHERE id = ?",
        args: [parseInt(id)],
      });

      const currentMeta = current.rows[0]?.meta
        ? JSON.parse(current.rows[0].meta)
        : {};

      const newMeta = JSON.stringify({
        ...currentMeta,
        ...(type !== undefined ? { type } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(concept_note !== undefined ? { concept_note } : {}),
        ...(concept_note_url !== undefined ? { concept_note_url } : {}),
        ...(assigned_pm_id !== undefined ? { assigned_pm_id } : {}),
      });

      updateFields.push("meta = ?");
      updateArgs.push(newMeta);

      // Also sync owner_id column with assigned_pm_id
      if (assigned_pm_id !== undefined) {
        updateFields.push("owner_id = ?");
        updateArgs.push(assigned_pm_id || null);
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update." },
        { status: 400 },
      );
    }

    updateArgs.push(parseInt(id));

    await db.execute({
      sql: `UPDATE v2_projects SET ${updateFields.join(", ")} WHERE id = ?`,
      args: updateArgs,
    });

    // Update project lead in members table if provided
    if (assigned_pm_id !== undefined) {
      // Remove existing lead(s)
      await db.execute({
        sql: "DELETE FROM project_members WHERE project_id::text = ? AND role = 'lead'",
        args: [String(id)],
      });

      // Assign new lead if provided
      if (assigned_pm_id) {
        await db.execute({
          sql: "INSERT INTO project_members (project_id, user_cid, role) VALUES (?, ?, 'lead') ON CONFLICT (project_id, user_cid) DO UPDATE SET role = 'lead'",
          args: [String(id), assigned_pm_id],
        });
      }
    }

    return NextResponse.json({ success: true, action: "updated" });
  } catch (error) {
    console.error("PUT /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
