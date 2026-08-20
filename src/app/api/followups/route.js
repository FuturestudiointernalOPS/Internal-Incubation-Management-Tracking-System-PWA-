import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession, requireProgramFacilitator, getFacilitatorTeamScope, hasProgramManagementAccess } from "@/lib/auth";

async function ensureFollowupSchema() {
  try {
    await db.execute("ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS created_by TEXT");
  } catch (_) {}
}

/**
 * For facilitators, resolve program assignment + team scope and return a guard.
 * Returns null for non-facilitators (no restriction).
 */
async function getFacilitatorScopeGuard(req, programId) {
  const session = await getSession();
  if (session && hasProgramManagementAccess(session.role)) return null;
  if (!programId) {
    return {
      deny: true,
      response: NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      ),
    };
  }
  const guardError = await requireProgramFacilitator(programId);
  if (guardError) return { deny: true, response: guardError };
  const scope = await getFacilitatorTeamScope(programId, session.cid);
  return { scope };
}

/**
 * FOLLOW-UPS API — TRACK 3 ENHANCED
 *
 * Supports creating and listing follow-up meetings.
 * Follow-ups are linked to submissions, participants, and programs.
 * Creating a follow-up also creates a calendar event in v2_events.
 */

export const GET = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager", "facilitator", "participant"] },
  async (req) => {
    await ensureFollowupSchema();
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");
    const submissionId = searchParams.get("submission_id");
    const status = searchParams.get("status");

    let sql = `
      SELECT f.*, c.name as participant_name, d.title as deliverable_title
      FROM v2_followups f
      LEFT JOIN contacts c ON f.participant_id::text = c.cid
      LEFT JOIN v2_submissions s ON f.submission_id = s.id
      LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id
      WHERE 1=1
    `;
    const args = [];

    if (programId) {
      sql += " AND f.program_id = ?";
      args.push(programId);
    }
    if (participantId) {
      sql += " AND f.participant_id = ?";
      args.push(participantId);
    }
    if (submissionId) {
      sql += " AND f.submission_id = ?";
      args.push(submissionId);
    }
    if (status) {
      sql += " AND f.status = ?";
      args.push(status);
    }

    // Visibility: super_admin sees all; participants see their own; everyone
    // else sees follow-ups they assigned. Legacy rows (created_by NULL) remain
    // visible to non-participant staff so historical data is not lost.
    if (session?.role === "participant") {
      sql += " AND f.participant_id = ?";
      args.push(session.cid);
    } else if (session?.role !== "super_admin") {
      sql += " AND (f.created_by IS NULL OR f.created_by = ?)";
      args.push(session.cid);
    }

    sql += " ORDER BY f.scheduled_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, followups: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager", "facilitator"] },
  async (req) => {
    await ensureFollowupSchema();
    const session = await getSession();
    const body = await req.json();
    const {
      program_id,
      participant_id,
      submission_id,
      week_number,
      comment,
      scheduled_at,
      duration_minutes,
      meeting_link,
      notes,
    } = body;

    if (!program_id || !scheduled_at) {
      return NextResponse.json(
        { success: false, error: "Program ID and scheduled date are required" },
        { status: 400 },
      );
    }

    // Facilitators may only create follow-ups for participants in their teams.
    const scopeGuard = await getFacilitatorScopeGuard(req, program_id);
    if (scopeGuard?.deny) return scopeGuard.response;
    if (scopeGuard && scopeGuard.scope.scope !== "all") {
      if (!participant_id || scopeGuard.scope.teamIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const inScope = await db.execute({
        sql: "SELECT 1 FROM contacts c WHERE c.cid = ? AND c.v2_team_id IN (" + scopeGuard.scope.teamIds.map(() => "?").join(",") + ")",
        args: [String(participant_id), ...scopeGuard.scope.teamIds],
      });
      if (inScope.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

    // Create follow-up record
    const result = await db.execute({
      sql: `INSERT INTO v2_followups (
          program_id, participant_id, submission_id, week_number,
          comment, scheduled_at, duration_minutes, meeting_link, notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?) RETURNING *`,
      args: [
        program_id,
        participant_id || null,
        submission_id || null,
        week_number || null,
        comment || null,
        scheduled_at,
        duration_minutes || 30,
        meeting_link || null,
        notes || null,
        session.cid || null,
      ],
    });

    // Create calendar event in v2_events
    try {
      const scheduledDate = new Date(scheduled_at);
      const endDate = new Date(scheduledDate.getTime() + (duration_minutes || 30) * 60000);

      await db.execute({
        sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, participant_id, created_by)
              VALUES (?, ?, ?, 'followup', ?, ?, ?, ?)`,
        args: [
          program_id,
          comment ? `Follow-up: ${comment.substring(0, 50)}` : "Follow-up Meeting",
          notes || comment || null,
          scheduledDate.toISOString(),
          endDate.toISOString(),
          participant_id || null,
          session.cid || "staff",
        ],
      });
    } catch (_) {
      // Calendar event creation is non-blocking
    }

    // If linked to a submission, update submission status to pending_followup
    if (submission_id) {
      try {
        await db.execute({
          sql: "UPDATE v2_submissions SET status = 'pending_followup', updated_at = NOW() WHERE id = ?",
          args: [submission_id],
        });
      } catch (_) {}
    }

    return NextResponse.json({ success: true, followup: result.rows[0] });
  },
);

export const PATCH = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager", "facilitator"] },
  async (req) => {
    const { id, status, notes, meeting_link, scheduled_at } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Follow-up ID required" },
        { status: 400 },
      );
    }

    // Facilitators may only update follow-ups for participants in their teams.
    const followupRes = await db.execute({
      sql: "SELECT program_id, participant_id FROM v2_followups WHERE id = ?",
      args: [id],
    });
    const followup = followupRes.rows[0];
    if (followup) {
      const scopeGuard = await getFacilitatorScopeGuard(req, followup.program_id);
      if (scopeGuard?.deny) return scopeGuard.response;
      if (scopeGuard && scopeGuard.scope.scope !== "all") {
        if (!followup.participant_id || scopeGuard.scope.teamIds.length === 0) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
        const inScope = await db.execute({
          sql: "SELECT 1 FROM contacts c WHERE c.cid = ? AND c.v2_team_id IN (" + scopeGuard.scope.teamIds.map(() => "?").join(",") + ")",
          args: [String(followup.participant_id), ...scopeGuard.scope.teamIds],
        });
        if (inScope.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: "errors.insufficientPermissions" },
            { status: 403 },
          );
        }
      }
    }

    await db.execute({
      sql: `UPDATE v2_followups SET
              status = COALESCE(?, status),
              notes = COALESCE(?, notes),
              meeting_link = COALESCE(?, meeting_link),
              scheduled_at = COALESCE(?, scheduled_at)
            WHERE id = ?`,
      args: [
        status || null,
        notes || null,
        meeting_link || null,
        scheduled_at || null,
        id,
      ],
    });

    return NextResponse.json({ success: true });
  },
);

// Also serve participant-facing follow-up list
export { GET as participantGET };
