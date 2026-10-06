import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { recordPublicCampaignResponse } from "@/services/platformRespond";

export async function POST(req) {
  try {
    await initDb();
    const { cid, form_id, answers, publicData, group_name } = await req.json();

    const result = await recordPublicCampaignResponse({ cid, form_id, answers, publicData, group_name });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json({
      success: true,
      message: "Response recorded",
      confidence_score: result.confidence_score,
      match_status: result.match_status,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
