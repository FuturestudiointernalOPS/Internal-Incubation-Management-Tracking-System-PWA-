import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { updateRespondentEmail } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { run_id, submission_id, email } = await req.json();
    if (!run_id || !submission_id || !email) {
      return NextResponse.json({ success: false, error: "run_id, submission_id and email are required" }, { status: 400 });
    }

    const result = await updateRespondentEmail({ run_id, submission_id, email, session });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({
      success: true,
      email: result.email,
      contact_updated: result.contact_updated,
      contact_conflict: result.contact_conflict,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}