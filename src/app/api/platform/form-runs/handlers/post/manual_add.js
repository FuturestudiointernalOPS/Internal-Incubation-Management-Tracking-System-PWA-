import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { manualAddRespondent } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { run_id, name, email, data, status: subStatus } = await req.json();
    if (!run_id) return NextResponse.json({ success: false, error: "run_id is required" }, { status: 400 });

    // Contact resolution (existing-by-email or created), the default "approved"
    // status, the scoring and the AI evaluation live in the service.
    const result = await manualAddRespondent({ run_id, name, email, data, status: subStatus, session });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true, submission: result.submission });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}