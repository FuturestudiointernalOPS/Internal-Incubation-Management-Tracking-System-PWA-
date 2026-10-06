import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { launchRun } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "create");
    if (authError) return authError;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const run = await launchRun({ id, session });
    return NextResponse.json({ success: true, run });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}