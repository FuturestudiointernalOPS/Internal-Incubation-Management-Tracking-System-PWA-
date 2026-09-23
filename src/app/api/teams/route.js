import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  hasProgramManagementAccess,
  requireAssignmentAccess,
} from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { stripTeamCredentials, generateTeamUsername, generateTeamPassword } from "@/lib/teamCredentials";
import { sendStandaloneEmail } from "@/lib/email";
import {
  getOrgTeams,
  getOrgTeamMembers,
  createOrgTeam,
  getOrgTeamParticipantEmails,
  linkOrgTeamContactsByEmail,
  linkOrgTeamContactsByCid,
  updateOrgTeam,
  clearOrgTeamMemberLinks,
  linkOrgTeamContactsByCidOnUpdate,
  clearOrgTeamMemberLinksOnDelete,
  deleteOrgTeam,
} from "@/models/groups";

export async function GET(req) {
  try {
    await initDb();
    // Phase 1.3: authentication only here — the decision is below.
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    let teamId = searchParams.get("team_id");

    // Team-entity sessions (role "team", session.cid = their own v2_teams.id)
    // may only ever read ITS OWN team — the caller-chosen team_id is bound
    // server-side. This runs first and is unaffected by the gates below.
    const session = await getSession();
    if (session?.role === "team") {
      const ownTeamId = String(session.cid || "");
      if (teamId && String(teamId) !== ownTeamId) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }
      if (!teamId) teamId = ownTeamId;
    }

    // Phase 1.3: staff/PM roster reads are governed — management roles and
    // programs.view holders may read (scoped by their params, as before);
    // everyone else must hold a program assignment and provide a real program
    // context ("all" is no longer an implicit platform-wide read).
    const capError = await requireAuthorization("programs", "view");
    const canReadTeams = !capError || hasProgramManagementAccess(session?.role);
    if (session?.role !== "team" && !canReadTeams) {
      if (!programId || programId === "all") {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const guardError = await requireAssignmentAccess({
        resource: "program",
        contextId: programId,
      });
      if (guardError) return guardError;
    }

    // Team-entity sessions read only their own team; authorized sessions read
    // with their params (program-scoped or, for capability holders, "all").
    const result = await getOrgTeams(programId, teamId);

    // If fetching a specific team, also include member details
    if (teamId && result.rows.length > 0) {
      const memberResult = await getOrgTeamMembers(teamId);
      result.rows[0].members = memberResult.rows;
    }

    // Shared team credentials are management data: only management roles receive
    // them. Everyone else (assignment holders, and a team reading its own row)
    // gets the roster without the shared username/password.
    const canSeeCredentials = hasProgramManagementAccess(session?.role);
    const teams = canSeeCredentials
      ? result.rows
      : result.rows.map(stripTeamCredentials);

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
    const authError = await requireAuth([
      "super_admin",
      "staff",
      "program_manager",
    ]);
    if (authError) return authError;
    const { program_id, name, handler_id, handler_name, member_ids } =
      await req.json();

    if (!program_id || !name) {
      return NextResponse.json(
        { success: false, error: "Program ID and Name are required." },
        { status: 400 },
      );
    }

    // Record scope: an org-team write belongs to a program the caller is staffed
    // on; the role list above only says which roles may write at all.
    const scopeError = await requireProgramScope({ programId: program_id, wave: "groups" });
    if (scopeError) return scopeError;

    // Generate Team Username (TEAM_SLUG_ID) and Password. Both come from a
    // cryptographic source (SECRET-3): a shared login credential must never be
    // derivable from Math.random().
    const generatedUsername = generateTeamUsername(name);
    const generatedPassword = generateTeamPassword();

    // Generate Team ID
    const teamId = `TEAM-${Date.now().toString(36).toUpperCase()}`;

    // 1. Create Team Record
    const result = await createOrgTeam(
      teamId,
      program_id,
      name,
      handler_id,
      handler_name,
      generatedPassword,
      generatedUsername,
    );

    const team = result.rows[0];

    // 2. Link Members to Team if provided (supports both contacts CIDs and v2_participants UUIDs)
    if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
      // Try finding matching contacts by participant ID (v2_participants.email → contacts.email)
      const participantsResult = await getOrgTeamParticipantEmails(member_ids);
      const emails = participantsResult.rows.map(row => row.email).filter(Boolean);

      if (emails.length > 0) {
        await linkOrgTeamContactsByEmail(team.id, emails);

        // Send welcome emails with team credentials
        for (const email of emails) {
          try {
            await sendStandaloneEmail({
              to: email,
              subject: `Team Credentials: ${name}`,
              body: `<p>You've been added to <b>${name}</b>. Use username <b>${generatedUsername}</b> and password <b>${generatedPassword}</b> to log in.</p>`,
              email_type: "team_credentials",
            });
          } catch (_) {}
        }
      } else {
        // Fallback: try direct CID match
        await linkOrgTeamContactsByCid(team.id, member_ids);
      }
    }

    return NextResponse.json({ success: true, team });
  } catch (error) {
    console.error("POST /api/teams error:", error);
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
    ]);
    if (authError) return authError;
    const { id, name, handler_id, handler_name, member_ids, is_venture_ready } =
      await req.json();

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: "Team ID and Name are required." },
        { status: 400 },
      );
    }

    // The team id comes from the client: resolve its program and confirm the
    // caller is staffed there before any write.
    const teamForScope = await getOrgTeams(null, id);
    const scopeError = await requireProgramScope({ programId: teamForScope.rows?.[0]?.program_id, wave: "groups" });
    if (scopeError) return scopeError;

    // 1. Update team record
    const sets = ["name = ?", "handler_id = ?", "handler_name = ?"];
    const args = [name, handler_id || null, handler_name || null];
    if (is_venture_ready !== undefined) {
      sets.push("is_venture_ready = ?");
      args.push(is_venture_ready);
    }
    args.push(id);
    await updateOrgTeam(sets, args);

    // 2. Clear existing member links for this team
    await clearOrgTeamMemberLinks(id);

    // 3. Re-link members if provided
    if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
      await linkOrgTeamContactsByCidOnUpdate(id, member_ids);
    }

    return NextResponse.json({ success: true });
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
    ]);
    if (authError) return authError;
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Team ID is required." },
        { status: 400 },
      );
    }

    // The team id comes from the client: resolve its program and confirm the
    // caller is staffed there before deleting anything.
    const teamForScope = await getOrgTeams(null, id);
    const scopeError = await requireProgramScope({ programId: teamForScope.rows?.[0]?.program_id, wave: "groups" });
    if (scopeError) return scopeError;

    // Clear member links first
    await clearOrgTeamMemberLinksOnDelete(id);

    // Delete the team
    await deleteOrgTeam(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
