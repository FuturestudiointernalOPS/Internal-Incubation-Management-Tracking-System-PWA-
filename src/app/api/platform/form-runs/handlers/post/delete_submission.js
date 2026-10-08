import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { deleteSubmission } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "delete");
    if (authError) return authError;

    const { submission_id } = await req.json();
    if (!submission_id) return NextResponse.json({ success: false, error: "submission_id required" }, { status: 400 });

    await deleteSubmission({ submission_id });

    return NextResponse.json({ success: true, message: "Submission deleted" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}