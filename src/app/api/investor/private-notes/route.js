import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { privateVentureNotes } from "@/services/investor/privateNotes";

async function notes(req, write) {
  try {
    const denied = await requireInvestorSelfServiceAuthorization(write ? "create" : "view");
    if (denied) return denied;
    const body = write ? await req.json() : {};
    const result = await privateVentureNotes({ session: await getSession(),
      ventureRef: write ? body.venture_id : new URL(req.url).searchParams.get("venture_id"),
      ...(write ? { content: body.content } : {}) });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, notes: result.notes }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}
export const GET = req => notes(req, false);
export const POST = req => notes(req, true);
