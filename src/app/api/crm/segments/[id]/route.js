import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { updateCrmSegment, deleteCrmSegment } from "@/models/crm/intelligence";

export const dynamic = "force-dynamic";

export const PATCH = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
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
  { roles: ["super_admin", "staff", "program_manager"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    const { id } = await params;
    await deleteCrmSegment(id);

    return NextResponse.json({ success: true });
  }
);
