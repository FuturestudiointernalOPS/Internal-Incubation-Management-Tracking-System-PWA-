import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import { buildWorkItems } from "@/services/workItems";

export const dynamic = "force-dynamic";

/**
 * GET /api/ventures/[id]/work-items — the Project Management read (Phase 1).
 *
 * Returns every milestone, activity and deliverable of ONE Venture in a single
 * operational shape, plus the filter choices and bucket counts they imply. It
 * is READ-ONLY: nothing here writes, and no route in this feature does.
 *
 * The gate is `ventures.view` — the same capability that already means "may
 * read this Venture's work", so a Super Admin and the Venture's own Lead
 * Manager see it without a new permission model. The SCOPE half of the gate is
 * what keeps a Venture Manager out of everyone else's work.
 *
 * The work itself is assembled by `@/services/workItems`; this controller owns
 * only the gate, the address and the response envelope.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { items, options, summary, today } = await buildWorkItems({ dbId, ventureCode: id });

    return NextResponse.json({ success: true, items, options, summary, today });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
