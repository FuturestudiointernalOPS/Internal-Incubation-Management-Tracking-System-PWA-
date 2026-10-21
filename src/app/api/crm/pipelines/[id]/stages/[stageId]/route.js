import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getCrmStageById, updateCrmPipelineStage } from "@/models/crm/pipelines";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/crm/pipelines/[id]/stages/[stageId] — rename a stage, change its
 * probability or (de)activate it (crm.manage). The order is changed through
 * PATCH …/stages; the terminal flag and outcome are set at creation, because
 * they decide how the deals already on the stage are counted.
 */
export const PATCH = createHandler(
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "manage");
    if (authError) return authError;

    const { id, stageId } = await params;
    const body = await req.json();

    const stage = (await getCrmStageById(stageId)).rows?.[0];
    if (!stage || String(stage.pipeline_id) !== String(id)) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.stageNotFound" },
        { status: 404 },
      );
    }

    const name = body.name === undefined ? undefined : String(body.name).trim();
    if (name === "") {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.stageNameRequired" },
        { status: 400 },
      );
    }

    const probability = body.probability == null ? undefined : Number(body.probability);
    if (probability !== undefined && !(probability >= 0 && probability <= 100)) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.probabilityRange" },
        { status: 400 },
      );
    }

    const result = await updateCrmPipelineStage(stageId, {
      name,
      description: body.description,
      probability,
      is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
    });

    return NextResponse.json({ success: true, stage: result.rows?.[0] ?? null });
  },
);
