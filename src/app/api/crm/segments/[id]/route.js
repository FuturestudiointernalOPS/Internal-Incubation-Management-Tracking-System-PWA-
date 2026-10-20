import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmSegmentById, updateCrmSegment, deleteCrmSegment } from "@/models/crm/intelligence";
import { resolveSegmentMembers } from "@/services/crm/segments";

export const dynamic = "force-dynamic";

/** GET — the segment and the records it currently contains (crm.view). */
export const GET = createHandler(
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { id } = await params;
    const segment = await getCrmSegmentById(id);
    if (!segment) {
      return NextResponse.json({ success: false, error: "crm.intelligence.segments.notFound" }, { status: 404 });
    }

    const members = await resolveSegmentMembers(segment);
    return NextResponse.json({ success: true, segment, members });
  }
);

export const PATCH = createHandler(
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();

    const result = await updateCrmSegment(id, body);
    if (!result.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Segment not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, segment: result.rows[0] });
  }
);

export const DELETE = createHandler(
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    const { id } = await params;
    await deleteCrmSegment(id);

    return NextResponse.json({ success: true });
  }
);
