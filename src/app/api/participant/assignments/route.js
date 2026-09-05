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
    for (const pid of programIds) {
      if (filterProgramId && pid !== filterProgramId) continue;

      const [progRes, delRes, subRes] = await Promise.all([
        getAssignmentsProgramById(pid),
        getAssignmentsDeliverablesByProgramId(pid),
        getAssignmentsSubmissionsByProgram(cid, pid),
      ]);

        const program = progRes.rows[0];
        if (!program) continue;
        const deliverables = (delRes.rows || []).filter((d) => {
          // Apply the requirement's stored assignee scoping. A PM can target a
          // requirement at everyone, a team, or a single individual. Without
          // this filter every participant would incorrectly see every
          // requirement regardless of how the PM scoped it.
          const type = String(d.assignee_type || "all").toLowerCase();
          if (type === "all" || !type) return true;
          if (type === "team") {
            const teamIds = [contact.v2_team_id, contact.team_id]
              .filter(Boolean)
              .map((t) => String(t));
            return teamIds.length > 0 && teamIds.includes(String(d.assignee_id));
          }
          if (type === "individual") {
            return String(d.assignee_id) === String(cid);
          }
          return true; // unknown scope — stay safe and visible
        });
        const submissions = subRes.rows || [];

        for (const d of deliverables) {
          // Match by document_id (preferred) or deliverable_id (legacy/int compat)
          const sub = submissions.find(
            (s) =>
              String(s.document_id) === String(d.id) ||
              String(s.deliverable_id) === String(d.id),
          );
        allAssignments.push({
          id: d.id,
          title: d.title,
          description: d.description,
          allowedFormat: d.allowed_format,
          resourceUrl: d.resource_url || null,
          resourceLabel: d.resource_label || null,
          weight: d.weight,
          programId: pid,
          programName: program.name,
          dueDate: d.due_date || d.created_at,
          submission: sub
            ? {
                id: sub.id,
                status: sub.status,
                fileUrl: sub.file_url,
                score: sub.score,
                submittedAt: sub.created_at,
                feedback: sub.feedback || null,
                rejectionReason: sub.rejection_reason || null,
              }
            : null,
        });
      }
    }

    const now = new Date();
    allAssignments.sort((a, b) => {
      const aOverdue = !a.submission && new Date(a.dueDate) < now ? 1 : 0;
      const bOverdue = !b.submission && new Date(b.dueDate) < now ? 1 : 0;
      if (aOverdue !== bOverdue) return bOverdue - aOverdue;
      return new Date(b.dueDate) - new Date(a.dueDate);
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
      const prev = existing.rows[0];
      // Archive previous version
      await archiveSubmissionVersion(
        prev.id,
        cid,
        deliverable_id,
        prev.file_url,
        prev.version || 1,
      );
      // Update with new version
      await updateSubmissionVersion(file_url || null, prev.id);
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
