import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { recordVerifiedInvestorInteraction } from "@/services/investor/interactions";

/** Intent only comes from the browser; identities, access and time are server-owned. */
export async function POST(req) {
  try {
    const denied = await requireInvestorSelfServiceAuthorization("view");
    if (denied) return denied;
    const { kind, venture_ids } = await req.json();
    const result = await recordVerifiedInvestorInteraction({ session: await getSession(), kind, ventureIds: venture_ids });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, recorded: result.recorded }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}
