import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * Team Tasks API — lightweight task board for teams
 *
 * GET  /api/team-tasks?team_id=X         — list tasks for a team
 * POST /api/team-tasks                   — create a task
 * PUT  /api/team-tasks                   — update a task
 * DELETE /api/team-tasks                 — delete a task
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "staff",
      "program_manager",
      "team",
    ]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("team_id");

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: "team_id is required" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `SELECT tt.*, c.name AS assigned_name
            FROM team_tasks tt
            LEFT JOIN contacts c ON tt.assigned_to = c.cid
            WHERE tt.team_id = ?
            ORDER BY
              CASE tt.priority
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
                ELSE 5
              END,
              tt.created_at DESC`,
      args: [teamId],
    });

    return NextResponse.json({ success: true, tasks: result.rows });
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
    const authError = await requireAuth([
      "super_admin",
      "staff",
      "program_manager",
      "team",
    ]);
    if (authError) return authError;
    const { team_id, title, description, status, priority, assigned_to, created_by } =
      await req.json();

    if (!team_id || !title) {
      return NextResponse.json(
        { success: false, error: "team_id and title are required" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO team_tasks (team_id, title, description, status, priority, assigned_to, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        team_id,
        title,
        description || null,
        status || "todo",
        priority || "medium",
        assigned_to || null,
        created_by || null,
      ],
    });

    return NextResponse.json({ success: true, task: result.rows[0] });
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
    const authError = await requireAuth([
      "super_admin",
      "staff",
      "program_manager",
      "team",
    ]);
    if (authError) return authError;
    const { id, title, description, status, priority, assigned_to } =
      await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Task ID is required" },
        { status: 400 },
      );
    }

    const sets = [];
    const args = [];
    if (title !== undefined) { sets.push("title = ?"); args.push(title); }
    if (description !== undefined) { sets.push("description = ?"); args.push(description); }
    if (status !== undefined) { sets.push("status = ?"); args.push(status); }
    if (priority !== undefined) { sets.push("priority = ?"); args.push(priority); }
    if (assigned_to !== undefined) { sets.push("assigned_to = ?"); args.push(assigned_to); }
    sets.push("updated_at = NOW()");

    if (sets.length === 1) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    args.push(id);
    const result = await db.execute({
      sql: `UPDATE team_tasks SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
      args,
    });

    return NextResponse.json({ success: true, task: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "staff",
      "program_manager",
      "team",
    ]);
    if (authError) return authError;
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Task ID is required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: "DELETE FROM team_tasks WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
