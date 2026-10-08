import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { archiveRun } from "@/services/platform/formRuns";

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("runs", "delete");
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    // The cascade order (logs first, then the report object, then the run)
    // lives in the service.
    await archiveRun({ id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}