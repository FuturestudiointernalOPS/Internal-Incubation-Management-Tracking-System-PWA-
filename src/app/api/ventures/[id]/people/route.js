import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import { ensureVentureSchema } from "@/services/ventures/schema";
import { linkNameToContact, listVenturePeople, unlinkName } from "@/services/ventures/people";

export const dynamic = "force-dynamic";

/**
 * /api/ventures/[id]/people — the names this Venture's work stands on, and the
 * person behind each one.
 *
 *   GET   the names, what they own or support, and where a reminder would go
 *   POST  { action: "link",   display_name, contact_id }  decide who a name is
 *         { action: "unlink", display_name }              forget it again
 *
 * Reads are gated on `ventures.view`, writes on `ventures.edit` — the same pair
 * every other Venture route uses, so whoever manages a Venture's work may
 * identify the people it names, and nobody gains a new kind of access by doing
 * so. A Venture Manager stays inside their own Ventures through the scope half
 * of that gate.
 *
 * IDENTIFYING A NAME GRANTS NOTHING. It writes one row that points at a contact
 * which already exists — no account is created, no invitation is sent, no
 * membership changes, and the name the tracker wrote is left exactly as it was.
 * The decisions live in `@/services/ventures/people`.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { people, summary } = await listVenturePeople({ ventureCode: id, dbId });
    return NextResponse.json({ success: true, people, summary });
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

    // The table this writes is NEW, and a Venture created before it existed has
    // never had the migration applied — the schema is maintained at runtime, on
    // first use of a feature (see `@/services/ventures/schema`). Only the WRITE
    // path pays for this: a read degrades to "no identity yet" instead.
    await ensureVentureSchema().catch(() => {});

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const actorCid = access.session?.cid || null;

    if (action === "link") {
      const result = await linkNameToContact({
        ventureCode: id,
        displayName: body?.display_name,
        contactCid: body?.contact_id,
        actorCid,
      });
      if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, linked: result.linked });
    }

    if (action === "unlink") {
      const result = await unlinkName({ ventureCode: id, displayName: body?.display_name });
      if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, unlinked: result.unlinked });
    }

    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
