import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmSegments, createCrmSegment } from "@/models/crm/intelligence";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entity_type");

    const result = await getCrmSegments(entityType);
    return NextResponse.json({ success: true, segments: result.rows || [] });
  }
);

export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "create");
    if (authError) return authError;

    const body = await req.json();
    const session = await getSession();

    if (!body.name || !body.entity_type) {
      return NextResponse.json({ success: false, error: "Name and entity_type are required." }, { status: 400 });
    }

    const result = await createCrmSegment({
      name: body.name,
      description: body.description,
      entityType: body.entity_type,
      conditions: body.conditions || [],
      createdBy: session?.user?.cid
    });

    return NextResponse.json({ success: true, segment: result.rows?.[0] });
  }
);
