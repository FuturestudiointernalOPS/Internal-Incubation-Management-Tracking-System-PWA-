import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAnyAuthorization } from "@/models/authorization/index";
import { regeneratePublicLink } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    // Rotating a run's public link is a run-management right. A delegated
    // investor creator owns the link they hand out, so `investor.create` is an
    // accepted alternative to `runs.edit` — never a replacement for it.
    const authError = await requireAnyAuthorization([
      { module: "runs", capability: "edit" },
      { module: "investor", capability: "create" },
    ]);
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
