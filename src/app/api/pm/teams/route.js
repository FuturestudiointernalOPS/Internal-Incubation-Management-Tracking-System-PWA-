import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  hasProgramManagementAccess,
  requireAssignmentAccess,
} from "@/lib/auth";
import {
  requireAuthorization,
  getAuthorizationContext,
  authorize,
} from "@/models/authorization/index";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { deleteTeam, getTeamById } from "@/models/teams";
import {
  applyTeamPatch,
  createTeamWithMembers,
  listProgramTeams,
} from "@/services/programs/teams";

export async function GET(req) {
  try {
    await initDb();
    // Phase 1.1 (watchlist): team rosters are program-scoped — authentication
    // only here; the decision is below (management / programs.view capability
    // / program assignment). Without a program context nothing is returned.
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    if (!programId) {
      return NextResponse.json(
        { success: false, error: "program_id required" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const ctx = session ? await getAuthorizationContext(session) : null;
    const canViewTeams =
      hasProgramManagementAccess(session?.role) ||
      (!!ctx && authorize(ctx, "programs", "view"));
    if (session && !canViewTeams) {
      const guardError = await requireAssignmentAccess({
        resource: "program",
        contextId: programId,
      });
      if (guardError) return guardError;
    }

    // Shared team credentials are management data: only management roles receive
    // them. A delegated reader gets the roster without username/password.
    const canSeeCredentials = hasProgramManagementAccess(session?.role);
    const teams = await listProgramTeams({ programId, canSeeCredentials });

    return NextResponse.json({ success: true, teams });
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
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;
    const payload = await req.json();
    const { program_id, name } = payload;

    if (!program_id || !name) {
      return NextResponse.json(
        { success: false, error: "Missing squad parameters." },
        { status: 400 },
      );
    }

    // Record scope: `programs.edit` says WHAT may be done; this says WHICH
    // program. A delegated holder must be staffed on the target program.
    const scopeError = await requireProgramScope({ programId: program_id, wave: "groups" });
    if (scopeError) return scopeError;

    const { team, linkingWarning } = await createTeamWithMembers({ payload });

    return NextResponse.json({
      success: true,
      team,
      ...(linkingWarning ? { warning: linkingWarning } : {}),
    });
  } catch (error) {
    console.error("Team Creation Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;
    const payload = await req.json();
    const { team_id } = payload;

    // Every action below targets one team, so its program is resolved first and
    // the caller must be staffed there — the team id arrives from the client.
    if (!team_id) {
      return NextResponse.json(
        { success: false, error: "Missing parameters." },
        { status: 400 },
      );
    }
    const teamForScope = await getTeamById(team_id);
    const scopeError = await requireProgramScope({ programId: teamForScope.rows?.[0]?.program_id, wave: "groups" });
    if (scopeError) return scopeError;

    const result = await applyTeamPatch({ payload });
    return NextResponse.json(result.body, { status: result.status });
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
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Team ID is required." },
        { status: 400 },
      );
    }
    const teamForScope = await getTeamById(id);
    const scopeError = await requireProgramScope({ programId: teamForScope.rows?.[0]?.program_id, wave: "groups" });
    if (scopeError) return scopeError;
    await deleteTeam(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
