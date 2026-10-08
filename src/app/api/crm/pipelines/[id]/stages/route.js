import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmPipelineStages,
  createCrmPipelineStage,
} from "@/models/crm/pipelines";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";

    const result = await getCrmPipelineStages(id, { includeInactive });
    return NextResponse.json({ success: true, stages: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();

    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.stageNameRequired" },
        { status: 400 },
      );
    }
    if (body.position == null) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.stagePositionRequired" },
        { status: 400 },
      );
    }

    const result = await createCrmPipelineStage({
      pipeline_id:  id,
      name,
      description:  body.description ?? null,
      position:     body.position,
      probability:  body.probability ?? 0,
      is_terminal:  body.is_terminal ?? false,
      outcome:      body.outcome ?? null,
    });

    return NextResponse.json(
      { success: true, stage: result.rows?.[0] },
      { status: 201 },
    );
  },
);
