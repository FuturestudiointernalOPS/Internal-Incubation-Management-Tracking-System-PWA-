import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { createRun } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "create");
    if (authError) return authError;

    const { form_id, name, description, opens_at, closes_at, assignments, settings } = await req.json();
    if (!form_id || !name) return NextResponse.json({ success: false, error: "form_id and name required" }, { status: 400 });

    // The form-version resolution, the slug, the persist, the initial
    // assignments and the creation automation live in the service (createRun).
    const result = await createRun({ form_id, name, description, opens_at, closes_at, assignments, settings, session });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true, run: result.run });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}