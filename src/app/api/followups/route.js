import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import {
  listFollowups,
} from "@/models/communications";
import {
  ensureFollowupSchema,
  createFollowup,
  evaluateFollowupParticipantAccess,
  updateScopedFollowup,
} from "@/services/communications/followups";

/**
 * FOLLOW-UPS API — TRACK 3 ENHANCED
 *
 * Supports creating and listing follow-up meetings.
 * Follow-ups are linked to submissions, participants, and programs.
 * Creating a follow-up also creates a calendar event in v2_events.
 */

// The visibility decision lives in the service: `listFollowups` scopes rows to
// the caller (participant → own rows; everyone else → rows they created), so
// the route only needs a session. Declared as a delegated decision.
export const GET = createHandler(async (req) => {
    await ensureFollowupSchema();
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");
    const submissionId = searchParams.get("submission_id");
    const status = searchParams.get("status");

    // Follow-up SQL (filters + visibility scoping) assembled in
    // src/models/communications.js (listFollowups)
    const result = await listFollowups({
      programId,
      participantId,
      submissionId,
      status,
      session,
    });
    return NextResponse.json({ success: true, followups: result.rows });
  },
);

// Creating a follow-up is decided by `evaluateFollowupParticipantAccess`: a
// program manager may, a facilitator only inside their team scope, and nobody
// else. The route serializes that decision; it holds no role list.
export const POST = createHandler(async (req) => {
    await ensureFollowupSchema();
    const session = await getSession();
    const body = await req.json();
    const { program_id, participant_id, scheduled_at } = body;

    if (!program_id || !scheduled_at) {
      return NextResponse.json(
        { success: false, error: "Program ID and scheduled date are required" },
        { status: 400 },
      );
    }

    const access = await evaluateFollowupParticipantAccess({ session, programId: program_id, participantId: participant_id });
    if (!access.allowed) return NextResponse.json({ success: false, error: access.errorKey }, { status: access.status });

    // Create follow-up record + calendar event + submission move
    const followup = await createFollowup({ session, payload: body });

    return NextResponse.json({ success: true, followup });
  },
);

// Updating a follow-up is scoped by `updateScopedFollowup` (same rule as the
// create path, fetched from the record's own program and participant).
export const PATCH = createHandler(
  async (req) => {
    const { id, status, notes, meeting_link, scheduled_at } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Follow-up ID required" },
        { status: 400 },
      );
    }

    const outcome = await updateScopedFollowup({ id, status, notes, meetingLink: meeting_link, scheduledAt: scheduled_at });
    if (!outcome.allowed) return NextResponse.json({ success: false, error: outcome.errorKey }, { status: outcome.status });

    return NextResponse.json({ success: true });
  },
);

// Also serve participant-facing follow-up list
export { GET as participantGET };
