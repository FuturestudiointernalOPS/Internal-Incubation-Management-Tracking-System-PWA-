import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getParticipantProgramIds } from "@/lib/participant-membership";
import {
  ensureSubmissionParticipantProgramIndex,
  ensureSubmissionDeliverableIndex,
  getAssignmentsContactByCid,
  getAssignmentsProgramById,
  getAssignmentsDeliverablesByProgramId,
  getAssignmentsSubmissionsByProgram,
  getExistingSubmission,
  archiveSubmissionVersion,
  updateSubmissionVersion,
  insertSubmission,
} from "@/models/participantPortal";

export const dynamic = "force-dynamic";

async function getSessionCid() {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  return session?.cid || null;
}

export async function GET(req) {
  try {
    await initDb();
    // Ensure index exists for performance
    try { await ensureSubmissionParticipantProgramIndex(); } catch (_) {}
    try { await ensureSubmissionDeliverableIndex(); } catch (_) {}
    const authError = await requireAuth();
    if (authError) return authError;

    const cid = await getSessionCid();
    if (!cid)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    const { searchParams } = new URL(req.url);
    const filterProgramId = searchParams.get("program_id");

    const contactRes = await getAssignmentsContactByCid(cid);
    if (contactRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 },
      );
    }
    const contact = contactRes.rows[0];

    const programIds = new Set(
      await getParticipantProgramIds({ cid, email: contact.email, contact }),
    );

    const allAssignments = [];
    for (const programId of programIds) {
      if (filterProgramId && programId !== filterProgramId) continue;

      const [progRes, delRes, subRes] = await Promise.all([
        getAssignmentsProgramById(programId),
        getAssignmentsDeliverablesByProgramId(programId),
        getAssignmentsSubmissionsByProgram(cid, programId),
      ]);

        const program = progRes.rows[0];
        if (!program) continue;
        const deliverables = (delRes.rows || []).filter((deliverable) => {
          // Apply the requirement's stored assignee scoping. A PM can target a
          // requirement at everyone, a team, or a single individual. Without
          // this filter every participant would incorrectly see every
          // requirement regardless of how the PM scoped it.
          const type = String(deliverable.assignee_type || "all").toLowerCase();
          if (type === "all" || !type) return true;
          if (type === "team") {
            const teamIds = [contact.v2_team_id, contact.team_id]
              .filter(Boolean)
              .map((teamId) => String(teamId));
            return teamIds.length > 0 && teamIds.includes(String(deliverable.assignee_id));
          }
          if (type === "individual") {
            return String(deliverable.assignee_id) === String(cid);
          }
          return true; // unknown scope — stay safe and visible
        });
        const submissions = subRes.rows || [];

        for (const deliverable of deliverables) {
          // Match by document_id (preferred) or deliverable_id (legacy/int compat)
          const matchedSubmission = submissions.find(
            (submission) =>
              String(submission.document_id) === String(deliverable.id) ||
              String(submission.deliverable_id) === String(deliverable.id),
          );
        allAssignments.push({
          id: deliverable.id,
          title: deliverable.title,
          description: deliverable.description,
          allowedFormat: deliverable.allowed_format,
          resourceUrl: deliverable.resource_url || null,
          resourceLabel: deliverable.resource_label || null,
          weight: deliverable.weight,
          programId,
          programName: program.name,
          dueDate: deliverable.due_date || deliverable.created_at,
          submission: matchedSubmission
            ? {
                id: matchedSubmission.id,
                status: matchedSubmission.status,
                fileUrl: matchedSubmission.file_url,
                score: matchedSubmission.score,
                submittedAt: matchedSubmission.created_at,
                feedback: matchedSubmission.feedback || null,
                rejectionReason: matchedSubmission.rejection_reason || null,
              }
            : null,
        });
      }
    }

    const now = new Date();
    allAssignments.sort((first, second) => {
      const firstOverdue = !first.submission && new Date(first.dueDate) < now ? 1 : 0;
      const secondOverdue = !second.submission && new Date(second.dueDate) < now ? 1 : 0;
      if (firstOverdue !== secondOverdue) return secondOverdue - firstOverdue;
      return new Date(second.dueDate) - new Date(first.dueDate);
    });

    return NextResponse.json({
      success: true,
      assignments: allAssignments,
      count: allAssignments.length,
    });
  } catch (error) {
    console.error("Assignments API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const cid = await getSessionCid();
    if (!cid)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    const { program_id, deliverable_id, file_url } = await req.json();
    if (!program_id || !deliverable_id) {
      return NextResponse.json(
        { success: false, error: "Program ID and deliverable ID required" },
        { status: 400 },
      );
    }

    // Check for existing submission (for version history)
    const existing = await getExistingSubmission(cid, deliverable_id);

    if (existing.rows.length > 0) {
      const previousSubmission = existing.rows[0];
      // Archive previous version
      await archiveSubmissionVersion(
        previousSubmission.id,
        cid,
        deliverable_id,
        previousSubmission.file_url,
        previousSubmission.version || 1,
      );
      // Update with new version
      await updateSubmissionVersion(file_url || null, previousSubmission.id);
    } else {
      await insertSubmission(cid, program_id, deliverable_id, file_url || null);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Assignment Submit Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
