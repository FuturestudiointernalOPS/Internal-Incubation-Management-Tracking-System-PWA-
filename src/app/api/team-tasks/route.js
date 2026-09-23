import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { getSession, hasProgramManagementAccess } from "@/lib/auth";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { serverError } from "@/lib/apiError";
import { getTeamById } from "@/models/teams";
import {
  getTeamTasks,
  getTeamTaskTeamId,
  createTeamTask,
  updateTeamTaskFields,
  deleteTeamTask,
} from "@/models/workspace";

/**
 * Team task board — a team's board is team-scoped:
 *   - a team-entity session (role "team", cid = its own team id) may only ever
 *     touch ITS OWN team;
 *   - management (super_admin / program_manager) is unscoped;
 *   - everyone else must be staffed on the program that owns the team.
 * A team id that cannot be attributed to a program is refused, never allowed.
 */
async function requireTeamTaskScope(teamId) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }
  if (session.role === "team") {
    if (String(teamId) !== String(session.cid)) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    return null;
  }
  if (hasProgramManagementAccess(session.role)) return null;
  const teamRow = (await getTeamById(teamId))?.rows?.[0];
  if (!teamRow) {
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }
  return requireProgramScope({ programId: teamRow.program_id, wave: "groups" });
}

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

    const scopeError = await requireTeamTaskScope(teamId);
    if (scopeError) return scopeError;

    const result = await getTeamTasks(teamId);

    return NextResponse.json({ success: true, tasks: result.rows });
  } catch (error) {
    return serverError(error, { log: "team-tasks GET" });
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

    const scopeError = await requireTeamTaskScope(team_id);
    if (scopeError) return scopeError;

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
    return serverError(error, { log: "team-tasks POST" });
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

    // A task id from the client: resolve its team (and the team's program)
    // before mutating anything.
    const taskTeamId = (await getTeamTaskTeamId(id))?.rows?.[0]?.team_id;
    if (!taskTeamId) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const scopeError = await requireTeamTaskScope(taskTeamId);
    if (scopeError) return scopeError;

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
    return serverError(error, { log: "team-tasks PUT" });
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

    // A task id from the client: resolve its team (and the team's program)
    // before deleting anything.
    const taskTeamId = (await getTeamTaskTeamId(id))?.rows?.[0]?.team_id;
    if (!taskTeamId) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const scopeError = await requireTeamTaskScope(taskTeamId);
    if (scopeError) return scopeError;

    await deleteTeamTask(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, { log: "team-tasks DELETE" });
  }
}
