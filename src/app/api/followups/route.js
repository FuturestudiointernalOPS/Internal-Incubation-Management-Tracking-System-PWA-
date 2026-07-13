import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

/**
 * FOLLOW-UPS API — TRACK 3 ENHANCED
 *
 * Supports creating and listing follow-up meetings.
 * Follow-ups are linked to submissions, participants, and programs.
 * Creating a follow-up also creates a calendar event in v2_events.
 */

export const GET = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");
    const submissionId = searchParams.get("submission_id");
    const status = searchParams.get("status");

    let sql = `
      SELECT f.*, p.name as participant_name, d.title as deliverable_title
      FROM v2_followups f
      LEFT JOIN v2_participants p ON f.participant_id = p.id
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

    sql += " ORDER BY f.scheduled_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, followups: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager"] },
  async (req) => {
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

    // Create follow-up record
    const result = await db.execute({
      sql: `INSERT INTO v2_followups (
          program_id, participant_id, submission_id, week_number,
          comment, scheduled_at, duration_minutes, meeting_link, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled') RETURNING *`,
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
          "staff",
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
  { roles: ["staff", "super_admin", "teacher", "program_manager"] },
  async (req) => {
    const { id, status, notes, meeting_link, scheduled_at } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Follow-up ID required" },
        { status: 400 },
      );
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
