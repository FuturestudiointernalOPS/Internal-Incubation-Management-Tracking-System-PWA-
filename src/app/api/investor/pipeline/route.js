import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { listPipelineForViewer, addOrUpdatePipeline } from "@/services/investor";

/** POST /api/investor/pipeline — add venture to pipeline or update stage */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const { venture_id, stage, notes, amount } = await req.json();
    if (!venture_id) {
      return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });
    }

    // The stage rules and the meeting / invested cascades live in the service.
    const result = await addOrUpdatePipeline({
      ventureId: venture_id,
      stage,
      notes,
      amount,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, pipeline: result.pipeline });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** GET /api/investor/pipeline — list pipeline for current investor or by venture */
export async function GET(req) {
  try {
    await initDb();
    // Phase 1.5: authentication only — scoping is derived in the service.
    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    const stage = searchParams.get("stage");

    const result = await listPipelineForViewer({
      ventureId,
      stage,
      session: await getSession(),
    });

    return NextResponse.json({ success: true, pipeline: result.pipeline });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
