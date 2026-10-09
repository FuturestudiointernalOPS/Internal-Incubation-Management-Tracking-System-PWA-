import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmPipelines,
  createCrmPipeline,
} from "@/models/crm/pipelines";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";

    const result = await getCrmPipelines({ includeInactive });
    return NextResponse.json({ success: true, pipelines: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();

    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.nameRequired" },
        { status: 400 },
      );
    }

    const result = await createCrmPipeline({
      name,
      description: body.description ?? null,
      type:        body.type ?? null,
      created_by:  session?.user?.cid ?? null,
    });

    return NextResponse.json(
      { success: true, pipeline: result.rows?.[0] },
      { status: 201 },
    );
  },
);
