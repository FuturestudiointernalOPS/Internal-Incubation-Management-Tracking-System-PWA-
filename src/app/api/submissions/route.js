import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireAssignmentAccess, hasProgramManagementAccess } from "@/lib/auth";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { serverError } from "@/lib/apiError";
import {
  ensureSubmissionsRoleLockColumn,
  getSubmissionProgramId,
  ensureSubmissionsTeamIdColumnForListing,
  listSubmissions,
} from "@/models/forms";
import {
  createSubmissionRecord,
  isSubmissionWithinFacilitatorScope,
  applySubmissionReview,
  bindSubmissionTeamScope,
  applyOwnSubmissionScope,
  needsFacilitatorSubmissionScope,
  resolveFacilitatorSubmissionScope,
  formatSubmissionRows,
  groupSubmissionVersions,
  saveSubmissionScore,
} from "@/services/ventures/submissions";

/**
 * SUBMISSIONS API — TRACK 3 ENHANCED
 * Supports versioning, instructor review actions, follow-up scheduling.
 * Never overwrites previous submissions — each POST creates a new version.
 */
export async function POST(req) {
  try {
    await initDb();
    // Phase 1.1 (watchlist): the self-service identity binding + membership
    // checks now live in `@/services/ventures/submissions`; authentication only
    // here.
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    const session = await getSession();

    const outcome = await createSubmissionRecord({ session, body });
    if (outcome.denied) {
      return NextResponse.json(
        { success: false, error: outcome.denied.error },
        { status: outcome.denied.status },
      );
    }

    return NextResponse.json({ success: true, submission: outcome.submission });
  } catch (error) {
    return serverError(error, { log: "submissions POST" });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    // Phase I5: the assignment + assignments.grade check below is the
    // security decision for every non-management session (facilitator or
    // staff, role-agnostic).
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing ID or status" },
        { status: 400 },
      );
    }

    // Server-side enforcement: facilitators must be assigned to the program
    // and hold assignments.grade to review submissions.
    const session = await getSession();
    // Ensure role-lock column exists before we read it below.
    try { await ensureSubmissionsRoleLockColumn(); } catch (_) {}
    if (session && !hasProgramManagementAccess(session.role)) {
      const submissionProgramResult = await getSubmissionProgramId(id);
      const programId = submissionProgramResult.rows[0]?.program_id;
      if (!programId) {
        return NextResponse.json(
          { success: false, error: "Submission not found" },
          { status: 404 },
        );
      }
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: programId,
        capability: "assignments.grade",
        minLevel: 1,
      });
      if (facError) return facError;
      // Fail closed: a facilitator with NO assigned teams has no record scope
      // in this program (mirrors the GET path).
      const inScope = await isSubmissionWithinFacilitatorScope({
        id,
        sessionCid: session.cid,
        programId,
      });
      if (!inScope) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

    // The review decision itself (business rules, role lock, write, follow-up,
    // notification, team propagation, KPI recalculation).
    const outcome = await applySubmissionReview({ session, payload: body });
    if (outcome.denied) {
      return NextResponse.json(
        { success: false, error: outcome.denied.error },
        { status: outcome.denied.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, { log: "submissions PATCH" });
  }
}

export async function GET(req) {
  try {
    await initDb();
    // Phase I6B: any authenticated session reaches the scoping below —
    // program context → assignment (assignments.view) + team scope for
    // non-management/non-staff/non-team sessions; no program context → own
    // rows only for those sessions. Staff and management keep their existing
    // unscoped reads.
    const authError = await requireAuth();
    if (authError) return authError;
    // Ensure team_id column exists so team-level submissions resolve.
    try {
      await ensureSubmissionsTeamIdColumnForListing();
    } catch (_) {}
    const { searchParams } = new URL(req.url);
    let participant_id = searchParams.get("participant_id");
    let team_id = searchParams.get("team_id");
    const group_id = searchParams.get("group_id");
    const program_id = searchParams.get("program_id");
    const deliverable_id = searchParams.get("deliverable_id");
    const document_id = searchParams.get("document_id");
    const status = searchParams.get("status");
    const include_versions = searchParams.get("include_versions") === "true";
    const latest_only = searchParams.get("latest_only") === "true";

    // Server-side enforcement: only facilitators must be assigned to the
    // program and hold assignments.view. Scope restricts to their assigned
    // groups. Participants/teams/staff read their own submissions directly.
    const session = await getSession();

    // Team-entity sessions (role "team", cid = their own team id) may only ever
    // read THEIR OWN team's submissions: the team filter is bound server-side,
    // so a chosen team_id / program_id cannot widen the read.
    const teamBinding = bindSubmissionTeamScope({ session, teamId: team_id });
    if (teamBinding.denied) {
      return NextResponse.json(
        { success: false, error: teamBinding.denied.error },
        { status: teamBinding.denied.status },
      );
    }
    team_id = teamBinding.teamId;

    // Own-scope (Phase I6B): without a program context, non-management,
    // non-staff, non-team sessions (participants, members, …) may only list
    // their own submissions — participant_id is bound server-side.
    participant_id = applyOwnSubmissionScope({ session, participantId: participant_id, programId: program_id });

    let facilitatorScopeFilter = null;
    let facilitatorScopeArgs = [];
    if (needsFacilitatorSubmissionScope(session, program_id)) {
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: program_id,
        capability: "assignments.view",
        minLevel: 1,
      });
      if (facError) return facError;
      const scopeOutcome = await resolveFacilitatorSubmissionScope({
        programId: program_id,
        sessionCid: session.cid,
      });
      if (scopeOutcome.empty) {
        return NextResponse.json({ success: true, submissions: [] });
      }
      facilitatorScopeFilter = scopeOutcome.facScopeFilter;
      facilitatorScopeArgs = scopeOutcome.facScopeArgs;
    }

    const { rows } = await listSubmissions({
      participant_id,
      team_id,
      group_id,
      program_id,
      deliverable_id,
      document_id,
      status,
      latest_only,
      facScopeFilter: facilitatorScopeFilter,
      facScopeArgs: facilitatorScopeArgs,
    });

    // Format for UI
    const submissions = formatSubmissionRows(rows);

    // If include_versions, group and include version history
    if (include_versions && (participant_id || group_id)) {
      const grouped = groupSubmissionVersions(submissions);
      return NextResponse.json({
        success: true,
        grouped,
        total: grouped.length,
      });
    }

    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    return serverError(error, { log: "submissions GET" });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
    if (authError) return authError;
    const { id, participant_id, program_id, score, evaluation_data } = await req.json();

    // Accept either a single submission id OR participant_id + program_id
    // (applies the same score to every submission of that participant).
    if (!id && (!participant_id || !program_id)) {
      return NextResponse.json(
        { success: false, error: "Missing submission ID or participant_id + program_id" },
        { status: 400 },
      );
    }

    // Record scope: a score write targets a program. With a submission id the
    // program is resolved from the submission; otherwise the caller names it.
    // Either way the caller must be staffed on that program.
    let targetProgramId = program_id || null;
    if (!targetProgramId && id) {
      const submissionProgram = await getSubmissionProgramId(id);
      targetProgramId = submissionProgram.rows?.[0]?.program_id || null;
    }
    const scopeError = await requireProgramScope({ programId: targetProgramId, wave: "content" });
    if (scopeError) return scopeError;

    // Ensure both score columns exist (migration safety), then write.
    await saveSubmissionScore({
      id,
      participantId: participant_id,
      programId: program_id,
      score,
      evaluationData: evaluation_data,
    });

    return NextResponse.json({ success: true, message: "Evaluation updated" });
  } catch (error) {
    return serverError(error, { log: "submissions PUT" });
  }
}
