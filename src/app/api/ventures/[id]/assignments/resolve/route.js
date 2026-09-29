import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import {
  resolveExternalAssignment,
  resolveExternalName,
  listExternalAssignees,
  ASSIGNMENT_LEVEL_NAMES,
} from "@/models/ventureAssignments";

export const dynamic = "force-dynamic";

/**
 * GET  /api/ventures/[id]/assignments/resolve
 *   the names this Venture is still tracking without a platform identity.
 *
 * POST /api/ventures/[id]/assignments/resolve
 *   { level, entity_id, contact_id }  — resolve ONE assignment
 *   { display_name, contact_id }      — resolve EVERY assignment standing on that name
 *
 * RESOLVING MEANS FILLING IN THE IDENTITY, NOT REPLACING THE NAME. The name the
 * tracker gave is kept, because it is the record of where the assignment came
 * from — clearing it would erase the only trace of that. The person now has a
 * platform identity beside their name, and every existing assignment is
 * untouched: nothing is merged, nothing is re-pointed, nothing is lost.
 *
 * Resolving grants NOTHING. Being assigned work has never been membership, and
 * the resolved contact still has exactly the access their account already had.
 * Platform access only changes through the Access Profile system.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const external = await listExternalAssignees({ dbId });
    return NextResponse.json({ success: true, external, levels: ASSIGNMENT_LEVEL_NAMES });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const contactId = body?.contact_id ? String(body.contact_id) : null;
    if (!contactId) return NextResponse.json({ success: false, error: "contact_id required." }, { status: 400 });

    const actorCid = access.session?.cid || null;

    // One decision, every assignment standing on that name.
    if (body.display_name) {
      const result = await resolveExternalName({ dbId, displayName: body.display_name, contactId, actorCid });
      if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, resolved: result.resolved, counts: result.counts });
    }

    // A single assignment.
    if (!ASSIGNMENT_LEVEL_NAMES.includes(body.level) || !body.entity_id) {
      return NextResponse.json(
        { success: false, error: "level and entity_id are required (or display_name for a whole name)." },
        { status: 400 },
      );
    }
    const result = await resolveExternalAssignment({
      dbId,
      level: body.level,
      entityId: body.entity_id,
      contactId,
      actorCid,
    });
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    return NextResponse.json({ success: true, resolved: result.resolved });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
