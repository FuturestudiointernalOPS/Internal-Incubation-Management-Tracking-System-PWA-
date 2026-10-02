import { NextResponse } from "next/server";
import {
  getParticipantProgramsService,
  assignParticipantToProgramsService,
  removeParticipantFromProgramService,
} from "@/services/programs/participantPrograms";

export const dynamic = "force-dynamic";

/**
 * PARTICIPANT-PROGRAMS API
 * Manages many-to-many relationship between participants and programs.
 *
 * GET    /api/participant-programs?participant_id=X  — Get all programs for a participant
 * POST   /api/participant-programs                   — Add participant to program(s)
 * DELETE /api/participant-programs                   — Remove participant from a program
 */

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get("participant_id");
    const programId = searchParams.get("program_id");

    const data = await getParticipantProgramsService({ participantId, programId });
    if (data.isAuthError) return data.response;

    return NextResponse.json(data);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ success: false, error: error.error }, { status: error.status });
    }
    console.error("GET participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const data = await assignParticipantToProgramsService(body);
    
    if (data.isAuthError) return data.response;

    return NextResponse.json(data);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ success: false, error: error.error }, { status: error.status });
    }
    console.error("POST participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json();
    const data = await removeParticipantFromProgramService(body);

    if (data.isAuthError) return data.response;

    return NextResponse.json(data);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ success: false, error: error.error }, { status: error.status });
    }
    console.error("DELETE participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
