import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  ensureSubmissionCreatedAtIndex,
  ensureSubmissionDeliverableIndex,
  ensureSubmissionParticipantProgramIndex,
  ensureSubmissionProgramIdIndex,
  getProgramsByAssignedPm,
  getSubmissionsByProgramIds,
} from "@/models/programWorkspace";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    // Ensure indexes for performance
    try { await ensureSubmissionProgramIdIndex(); } catch (_) {}
    try { await ensureSubmissionParticipantProgramIndex(); } catch (_) {}
    try { await ensureSubmissionDeliverableIndex(); } catch (_) {}
    try { await ensureSubmissionCreatedAtIndex(); } catch (_) {}
    const { searchParams } = new URL(req.url);
    const assignedPmId = searchParams.get("assigned_pm_id");

    if (!assignedPmId) {
      return NextResponse.json(
        { success: false, error: "assigned_pm_id is required" },
        { status: 400 },
      );
    }

    // Phase 3C-9: non-Super-Admin users may only read submissions for their
    // OWN PM scope (assigned_pm_id must equal the session cid). A staff member
    // cannot pass another person's id to read their submissions.
    const session = await getSession();
    if (
      session?.role !== "super_admin" &&
      String(assignedPmId) !== String(session?.cid)
    ) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    const programsResult = await getProgramsByAssignedPm(assignedPmId);
    const programs = programsResult.rows || [];
    const programIds = programs.map((program) => String(program.id));

    if (programIds.length === 0) {
      return NextResponse.json({ success: true, submissions: [], programs });
    }

    const submissionsResult = await getSubmissionsByProgramIds(programIds);

    const programNamesById = {};
    for (const program of programs) programNamesById[program.id] = program.name;
    const submissions = (submissionsResult.rows || []).map((submission) => ({
      ...submission,
      program_name: programNamesById[submission.program_id] || null,
    }));

    return NextResponse.json({ success: true, submissions, programs });
  },
);
