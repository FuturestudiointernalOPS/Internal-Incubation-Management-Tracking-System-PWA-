import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import { listVentureChanges } from "@/models/ventureChangeLog";

export const dynamic = "force-dynamic";

/**
 * GET /api/ventures/[id]/changes?entity_type=&entity_id=&limit=
 *
 * The Venture's change history — what changed, from what, to what, when, and by
 * whom. Read-only: rows are written by the choke points (journey PATCH, milestone
 * PATCH, plan apply) and are never edited or deleted, so the history can be
 * trusted as a record rather than as another view to keep in step.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const searchParams = new URL(req.url).searchParams;
    const changes = await listVentureChanges({
      dbId,
      entityType: searchParams.get("entity_type"),
      entityId: searchParams.get("entity_id"),
      limit: searchParams.get("limit"),
    });

    return NextResponse.json({ success: true, changes });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
