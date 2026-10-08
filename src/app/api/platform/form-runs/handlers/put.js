import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { updateRunMetadata } from "@/services/platform/formRuns";

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { id, name, description, status, opens_at, closes_at, settings } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    // The Output Instruction validation (a string, bounded, stored trimmed —
    // blank means "no instruction, default report") lives in the service.
    const result = await updateRunMetadata({ id, name, description, status, opens_at, closes_at, settings });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true, run: result.run });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}