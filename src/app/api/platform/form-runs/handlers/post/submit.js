import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { submitResponse } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const { run_id, data, status: subStatus } = await req.json();
    if (!run_id) return NextResponse.json({ success: false, error: "run_id is required" }, { status: 400 });

    // The active/deadline/multiple/limit rules, the scoring, the AI evaluation
    // and the submission automation live in the service (submitResponse).
    const result = await submitResponse({ run_id, data, status: subStatus, session });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true, submission: result.submission });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}