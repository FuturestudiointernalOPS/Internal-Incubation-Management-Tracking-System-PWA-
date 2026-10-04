import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import {
  ensureSubmissionParticipantProgramIndex,
  ensureSubmissionDeliverableIndex,
  getAssignmentsContactByCid,
} from "@/models/participantPortal";
import {
  buildParticipantAssignments,
  submitAssignmentVersion,
} from "@/services/participant";

export const dynamic = "force-dynamic";

async function getSessionCid() {
  const { getSession } = await import("@/server/auth/session");
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

    // The scoping, matching and ordering decisions live in the participant
    // service; this handler only authenticates, reads the contact and shapes
    // the response.
    const assignments = await buildParticipantAssignments({
      cid,
      contact: contactRes.rows[0],
      filterProgramId,
    });

    return NextResponse.json({
      success: true,
      assignments,
      count: assignments.length,
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

    // First version or new version — decided in the participant service.
    await submitAssignmentVersion({
      cid,
      programId: program_id,
      deliverableId: deliverable_id,
      fileUrl: file_url,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Assignment Submit Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
