import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { regeneratePublicLink } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const authError = await requireAuthorization("runs", "edit");
    if (authError) return authError;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });

    const result = await regeneratePublicLink({ id });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true, run: result.run, public_slug: result.public_slug });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}