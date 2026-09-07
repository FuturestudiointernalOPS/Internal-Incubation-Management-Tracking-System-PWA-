import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  getTeamTasks,
  createTeamTask,
  updateTeamTaskFields,
  deleteTeamTask,
} from "@/models/workspace";

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
    const capError = await requireAuthorization("tasks", "view");
    if (capError) return capError;
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("team_id");

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: "team_id is required" },
        { status: 400 },
      );
    }

    const result = await getTeamTasks(teamId);

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
    const capError = await requireAuthorization("tasks", "create");
    if (capError) return capError;
    const { team_id, title, description, status, priority, assigned_to, created_by } =
      await req.json();

    if (!team_id || !title) {
      return NextResponse.json(
        { success: false, error: "team_id and title are required" },
        { status: 400 },
      );
    }

    const result = await createTeamTask(
      team_id,
      title,
      description || null,
      status || "todo",
      priority || "medium",
      assigned_to || null,
      created_by || null,
    );

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
    const capError = await requireAuthorization("tasks", "edit");
    if (capError) return capError;
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

    const result = await updateTeamTaskFields(id, sets, args);

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
    const capError = await requireAuthorization("tasks", "delete");
    if (capError) return capError;
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Task ID is required" },
        { status: 400 },
      );
    }

    await deleteTeamTask(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
