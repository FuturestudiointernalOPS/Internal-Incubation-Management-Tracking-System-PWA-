import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgressContactByCid } from "@/models/participantPortal";
import { buildParticipantProgress } from "@/services/participant";

export const dynamic = "force-dynamic";

export async function GET(_req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    const cid = session.cid;
    const email = session.email;

    const contactResult = await getProgressContactByCid(cid);
    if (contactResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant not found" },
        { status: 404 },
      );
    }
    const contact = contactResult.rows[0];

    // Every rule and read of the report lives in the participant service
    // (src/services/participant/progress.js); this handler only authenticates,
    // reads the contact and shapes the response.
    const { programs, overall, totals } = await buildParticipantProgress({
      cid,
      email,
      contact,
    });

    return NextResponse.json({
      success: true,
      participant: {
        name: contact.name,
        email: contact.email,
        groupName: contact.group_name,
      },
      overall,
      programs,
      totals,
    });
  } catch (error) {
    console.error("Progress API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
