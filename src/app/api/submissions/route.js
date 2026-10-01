import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireAssignmentAccess, getFacilitatorTeamScope, hasProgramManagementAccess } from "@/lib/auth";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { serverError } from "@/lib/apiError";
import {
  ensureSubmissionsRoleLockColumn,
  getSubmissionProgramId,
  ensureSubmissionsTeamIdColumnForListing,
  listSubmissions,
  ensureSubmissionScoresColumn,
  ensureSubmissionEvaluationScoreColumn,
  updateSubmissionScoreById,
  updateSubmissionsScoreForParticipant,
} from "@/models/forms";
import {
  createSubmissionRecord,
  isSubmissionWithinFacilitatorScope,
  applySubmissionReview,
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
    let facilitatorScopeFilter = null;
    let facilitatorScopeArgs = [];

    // Team-entity sessions (role "team", cid = their own team id) may only ever
    // read THEIR OWN team's submissions: the team filter is bound server-side,
    // so a chosen team_id / program_id cannot widen the read.
    if (session?.role === "team") {
      const ownTeamId = String(session.cid || "");
      if (team_id && String(team_id) !== ownTeamId) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      team_id = ownTeamId;
    }

    // Own-scope (Phase I6B): without a program context, non-management,
    // non-staff, non-team sessions (participants, members, …) may only list
    // their own submissions — participant_id is bound server-side.
    if (
      session &&
      !program_id &&
      !hasProgramManagementAccess(session.role) &&
      session.role !== "staff" &&
      session.role !== "team"
    ) {
      participant_id = session.cid;
    }

    if (
      session &&
      program_id &&
      !hasProgramManagementAccess(session.role) &&
      session.role !== "staff" &&
      session.role !== "team"
    ) {
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: program_id,
        capability: "assignments.view",
        minLevel: 1,
      });
      if (facError) return facError;
      const scope = await getFacilitatorTeamScope(program_id, session.cid);
      if (scope.scope !== "all") {
        if (scope.teamIds.length === 0) {
          return NextResponse.json({ success: true, submissions: [] });
        }
        facilitatorScopeFilter =
          "s.participant_id IN (SELECT c.cid FROM contacts c WHERE c.v2_team_id IN (" +
          scope.teamIds.map(() => "?").join(",") +
          "))";
        facilitatorScopeArgs = scope.teamIds;
      }
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
    const submissions = rows.map((row) => ({
      ...row,
      v2_deliverables: {
        title: row.deliverable_title,
        week_number: row.deliverable_week,
        due_date: row.deliverable_due_date,
      },
      v2_participants: row.participant_name ? { name: row.participant_name } : null,
      v2_groups: row.group_name ? { name: row.group_name } : null,
    }));

    // If include_versions, group and include version history
    if (include_versions && (participant_id || group_id)) {
      const grouped = {};
      for (const submission of submissions) {
        const groupId = submission.deliverable_id || submission.document_id || `doc-${submission.id}`;
        const key = `${submission.program_id}-${groupId}`;
        if (!grouped[key]) {
          grouped[key] = {
            deliverable_id: submission.deliverable_id,
            program_id: submission.program_id,
            deliverable_title: submission.deliverable_title,
            deliverable_week: submission.deliverable_week,
            deliverable_due_date: submission.deliverable_due_date,
            latest: submission,
            versions: [],
          };
        }
        grouped[key].versions.push(submission);
        // Sort versions by version_number
        grouped[key].versions.sort(
          (first, second) => (second.version_number || 0) - (first.version_number || 0),
        );
      }

      return NextResponse.json({
        success: true,
        grouped: Object.values(grouped),
        total: Object.keys(grouped).length,
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

    // Ensure both score columns exist (migration safety).
    try { await ensureSubmissionScoresColumn(); } catch (_) {}
    try { await ensureSubmissionEvaluationScoreColumn(); } catch (_) {}

    const payload = {
      score: score != null ? parseInt(score) : null,
      evaluation_score: score != null ? parseInt(score) : null,
      evaluation_data: evaluation_data ? JSON.stringify(evaluation_data) : null,
    };

    if (id) {
      await updateSubmissionScoreById({
        ...payload,
        id,
      });
    } else {
      await updateSubmissionsScoreForParticipant({
        ...payload,
        participant_id,
        program_id,
      });
    }

    return NextResponse.json({ success: true, message: "Evaluation updated" });
  } catch (error) {
    return serverError(error, { log: "submissions PUT" });
  }
}
