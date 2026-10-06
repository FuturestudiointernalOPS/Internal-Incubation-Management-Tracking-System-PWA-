import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { retryFailedEmails } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { run_id, retries } = await req.json();
    if (!run_id || !Array.isArray(retries) || retries.length === 0) {
      return NextResponse.json({ success: false, error: "run_id and retries are required" }, { status: 400 });
    }

    if (!retries.every((retry) => retry && Number.isFinite(parseInt(retry.submission_id)) && typeof retry.email_type === "string")) {
      return NextResponse.json({ success: false, error: "Each retry needs submission_id and email_type" }, { status: 400 });
    }

    const { results } = await retryFailedEmails({ run_id, retries, session });
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}