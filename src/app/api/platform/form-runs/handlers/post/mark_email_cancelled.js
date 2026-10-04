import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { markEmailsCancelled } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { run_id, items } = await req.json();
    if (!run_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "run_id and items are required" }, { status: 400 });
    }
    if (items.length > 100) {
      return NextResponse.json({ success: false, error: "A cancel batch can process at most 100 items" }, { status: 400 });
    }

    const { marked } = await markEmailsCancelled({ run_id, items });
    return NextResponse.json({ success: true, marked });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}