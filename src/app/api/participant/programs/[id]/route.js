import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { getParticipantProgramDetailService } from "@/services/programs/participant";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const cid = session.cid;
    const { id: programId } = await params;

    const serviceRes = await getParticipantProgramDetailService({ cid, email: session.email, programId });

    if (serviceRes.status !== 200) {
      return NextResponse.json(serviceRes.body, { status: serviceRes.status });
    }

    return NextResponse.json(serviceRes.body);

  } catch (error) {
    console.error("Participant Program Detail Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
