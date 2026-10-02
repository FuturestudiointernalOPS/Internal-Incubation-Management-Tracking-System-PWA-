import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { buildDiligenceForViewer, runDiligenceAction } from "@/services/investor";

/** GET /api/investor/diligence?pipeline_id=X */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");
    if (!pipelineId) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    // The own-scope decision and the reads live in the investor service.
    const result = await buildDiligenceForViewer({
      pipelineId,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      workspace: result.workspace,
      requests: result.requests,
      notes: result.notes,
      pipeline: result.pipeline,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/diligence — create/update workspace */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const { pipeline_id: pipelineId, action, ...payload } = await req.json();
    if (!pipelineId) {
      return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });
    }

    // The own-scope binding, the transitions and every action decision live in
    // the investor service; this handler only authenticates and shapes.
    const result = await runDiligenceAction({
      action,
      payload,
      session: await getSession(),
      pipelineId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    const { ok: _ok, error: _error, status: _status, ...data } = result;
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
