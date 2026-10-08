import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { buildParticipantFullState, canReadFullState } from "@/services/participant";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const groupName = searchParams.get("group_name");

    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );

    // The read-others decision lives in the participant service.
    if (!canReadFullState({ role: session.role, sessionEmail: session.email, email })) {
      return NextResponse.json(
        { success: false, error: "You can only access your own data." },
        { status: 403 },
      );
    }

    if (!email || !groupName)
      return NextResponse.json({
        success: false,
        error: "Email and Group Name required",
      });

    const state = await buildParticipantFullState({ email, groupName });

    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
