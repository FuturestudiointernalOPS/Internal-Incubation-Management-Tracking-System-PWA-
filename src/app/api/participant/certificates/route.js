import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { getParticipantCertificates } from "@/models/participantPortal";

export const dynamic = "force-dynamic";

/**
 * GET /api/participant/certificates
 *
 * Certificates issued to the current user (participant_programs rows with
 * certificate_issued = true). Returns an empty list when none exist.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const res = await getParticipantCertificates(session.cid);

    return NextResponse.json({ success: true, certificates: res.rows });
  } catch (error) {
    console.error("[participant certificates] error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
