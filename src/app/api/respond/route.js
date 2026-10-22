import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { recordPublicCampaignResponse } from "@/services/platformRespond";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req) {
  try {
    await initDb();

    // PROTECT-RESPOND-1 — the campaign-respond endpoint is public by design (a
    // respondent is not signed in), so it cannot carry a permission decision.
    // The minimal, non-breaking guard is a per-IP rate limit that stops mass
    // injection and unbounded growth while leaving a real respondent unaffected.
    const limited = enforceRateLimit(
      req,
      `public-respond:ip:${getClientIp(req)}`,
      { limit: 60, windowMs: 60 * 60 * 1000 },
    );
    if (limited) return limited;

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
