import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { updateSection, moveSection, deleteSection } from "@/lib/lms/sections";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * PUT /api/lms/sections/[id]
 * Update a section, or reorder it with { action: "move", direction: "up"|"down" }.
 * Requires lms.edit.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    if (body.action === "move") {
      const result = await moveSection(id, body.direction);
      return NextResponse.json({ success: true, ...result });
    }
    const section = await updateSection(id, body);
    return NextResponse.json({ success: true, section });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

/**
 * DELETE /api/lms/sections/[id] — delete a section (safe-delete guard:
 * refuses when any lesson in it has learner progress). Requires lms.edit.
 */
export async function DELETE(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const result = await deleteSection(id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
