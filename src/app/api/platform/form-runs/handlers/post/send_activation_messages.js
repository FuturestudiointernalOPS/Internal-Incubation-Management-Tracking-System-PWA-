import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { sendActivationMessages } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { run_id, submission_ids, force } = await req.json();
    if (!run_id || !Array.isArray(submission_ids) || submission_ids.length === 0) {
      return NextResponse.json({ success: false, error: "run_id and submission_ids are required" }, { status: 400 });
    }

    const { results } = await sendActivationMessages({ run_id, submission_ids, force, session });
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}