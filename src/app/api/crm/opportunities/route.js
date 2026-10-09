import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmOpportunities,
  createCrmOpportunity,
  getCrmPipelineMetrics,
} from "@/models/crm/opportunities";
import {
  getCrmPipelineById,
  getCrmStageById,
  getFirstCrmPipelineStage,
} from "@/models/crm/pipelines";
import { appendCrmStageHistory } from "@/models/crm/stageHistory";
import { addContactTimelineEvent } from "@/services/contacts/timeline";

export const dynamic = "force-dynamic";

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { searchParams } = new URL(req.url);

    const [opps, metrics] = await Promise.all([
      getCrmOpportunities({
        pipelineId:     searchParams.get("pipeline_id") ?? undefined,
        stageId:        searchParams.get("stage_id") ?? undefined,
        ownerCid:       searchParams.get("owner_cid") ?? undefined,
        status:         searchParams.get("status") ?? undefined,
        contactCid:     searchParams.get("contact_cid") ?? undefined,
        organizationId: searchParams.get("organization_id") ?? undefined,
      }),
      getCrmPipelineMetrics(searchParams.get("pipeline_id") ?? null),
    ]);

    return NextResponse.json({
      success:       true,
      opportunities: opps.rows,
      metrics:       metrics.rows?.[0] ?? null,
    });
  },
);

export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "create");
    if (authError) return authError;

    const session = await getSession();
    const body    = await req.json();

    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.nameRequired" },
        { status: 400 },
      );
    }

    if (!body.pipeline_id) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.pipelineRequired" },
        { status: 400 },
      );
    }

    if (!body.lead_id && !body.contact_cid && !body.organization_id) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.targetRequired" },
        { status: 400 },
      );
    }

    // Validate pipeline exists
    const pipelineResult = await getCrmPipelineById(body.pipeline_id);
    if (!pipelineResult.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.notFound" },
        { status: 404 },
      );
    }

    // Validate probability range
    const prob = body.probability != null ? parseInt(body.probability) : null;
    if (prob != null && (prob < 0 || prob > 100)) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.probabilityRange" },
        { status: 400 },
      );
    }

    // Resolve stage: use provided or fall back to first stage in pipeline
    let stageId = body.stage_id ?? null;
    if (!stageId) {
      const firstStage = await getFirstCrmPipelineStage(body.pipeline_id);
      stageId = firstStage.rows?.[0]?.id ?? null;
    }
    if (!stageId) {
      return NextResponse.json(
        { success: false, error: "crm.pipelines.noStages" },
        { status: 400 },
      );
    }

    // Validate stage belongs to declared pipeline
    const stageResult = await getCrmStageById(stageId);
    const stage = stageResult.rows?.[0];
    if (!stage || stage.pipeline_id !== body.pipeline_id) {
      return NextResponse.json(
        { success: false, error: "crm.opportunities.stagePipelineMismatch" },
        { status: 400 },
      );
    }

    const actorCid = session?.user?.cid ?? null;

    const result = await createCrmOpportunity({
      name,
      description:         body.description ?? null,
      lead_id:             body.lead_id ?? null,
      contact_cid:         body.contact_cid ?? null,
      organization_id:     body.organization_id ?? null,
      pipeline_id:         body.pipeline_id,
      stage_id:            stageId,
      owner_cid:           body.owner_cid ?? actorCid,
      value:               body.value ?? null,
      currency:            body.currency ?? null,
      probability:         prob,
      expected_close_date: body.expected_close_date ?? null,
      created_by:          actorCid,
    });

    const opp = result.rows?.[0];

    if (opp) {
      // Append initial stage history row (from_stage = null = creation)
      await appendCrmStageHistory({
        opportunity_id: opp.id,
        from_stage_id:  null,
        to_stage_id:    stageId,
        changed_by:     actorCid,
        metadata:       { event: "created" },
      });

      // Timeline: only if tied to a person
      if (opp.contact_cid) {
        await addContactTimelineEvent({
          cid: opp.contact_cid,
          eventType: "opportunity_created",
          description: `Opportunity created: ${opp.name}`,
          actorCid,
          metadata:    { opportunity_id: opp.id, pipeline_id: opp.pipeline_id },
        });
      }
    }

    return NextResponse.json({ success: true, opportunity: opp }, { status: 201 });
  },
);
