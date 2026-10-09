import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmPipelineWithStages,
  updateCrmPipeline,
} from "@/models/crm/pipelines";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { id } = await params;
    const { pipeline, stages } = await getCrmPipelineWithStages(id);

    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, pipeline, stages });
  },
);

export const PATCH = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();

    const result = await updateCrmPipeline(id, {
      name:        body.name,
      description: body.description,
      type:        body.type,
      is_active:   body.is_active,
    });

    const pipeline = result.rows?.[0];
    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, pipeline });
  },
);
