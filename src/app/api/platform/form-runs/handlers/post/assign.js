import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { assignRunTargets } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    // Accept either the legacy single target (target_type + target_id) or a
    // list of targets so one action can assign a run to multiple audiences
    // (e.g. Program AND Group) in a single request — the service owns the
    // allowed target types and the insert/skip decision.
    const { run_id, target_type, target_id, targets } = await req.json();
    if (!run_id) return NextResponse.json({ success: false, error: "run_id and target required" }, { status: 400 });

    const result = await assignRunTargets({ run_id, target_type, target_id, targets, session });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, added: result.added, skipped: result.skipped, assignments: result.assignments });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}