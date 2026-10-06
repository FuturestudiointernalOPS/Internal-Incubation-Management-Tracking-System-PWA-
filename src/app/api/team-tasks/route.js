import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { serverError } from "@/lib/apiError";
import {
  createTeamBoardTask,
  deleteTeamBoardTask,
  listTeamBoardTasks,
  resolveTeamBoardScope,
  resolveTeamBoardTaskScope,
  updateTeamBoardTask,
} from "@/services/tasks/teamBoard";

/**
 * Team Tasks API — controller layer.
 *
 * GET  /api/team-tasks?team_id=X         — list tasks for a team
 * POST /api/team-tasks                   — create a task
 * PUT  /api/team-tasks                   — update a task
 * DELETE /api/team-tasks                 — delete a task
 *
 * Auth, the record-scope guard, validation and response shaping only. Which
 * teams a session may reach, the writable columns and the four use cases live
 * in `@/services/tasks/teamBoard`; `requireProgramScope` stays here because the
 * "groups" coverage census holds this surface wired to it.
 */

/**
 * Run the record-scope guard the service asked for. A `program-scope` verdict
 * means the caller must additionally be staffed on the owning program; the
 * other two verdicts were already settled by the service.
 */
async function enforceTeamBoardScope(verdict) {
  if (verdict.kind === "deny") {
    return NextResponse.json(
      { success: false, error: verdict.errorKey },
      { status: verdict.status },
    );
  }
  if (verdict.kind === "allow") return null;
  return requireProgramScope({ programId: verdict.programId, wave: "groups" });
}

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

    const scopeError = await enforceTeamBoardScope(await resolveTeamBoardScope(teamId));
    if (scopeError) return scopeError;

    const result = await listTeamBoardTasks(teamId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return serverError(error, { log: "team-tasks GET" });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("tasks", "create");
    if (capError) return capError;
    const body = await req.json();

    if (!body.team_id || !body.title) {
      return NextResponse.json(
        { success: false, error: "team_id and title are required" },
        { status: 400 },
      );
    }

    const scopeError = await enforceTeamBoardScope(await resolveTeamBoardScope(body.team_id));
    if (scopeError) return scopeError;

    const result = await createTeamBoardTask(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return serverError(error, { log: "team-tasks POST" });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("tasks", "edit");
    if (capError) return capError;
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Task ID is required" },
        { status: 400 },
      );
    }

    const scopeError = await enforceTeamBoardScope(
      await resolveTeamBoardTaskScope(body.id),
    );
    if (scopeError) return scopeError;

    const result = await updateTeamBoardTask({ id: body.id, patch: body });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
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

    const scopeError = await enforceTeamBoardScope(await resolveTeamBoardTaskScope(id));
    if (scopeError) return scopeError;

    const result = await deleteTeamBoardTask(id);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return serverError(error, { log: "team-tasks DELETE" });
  }
}