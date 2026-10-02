import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import { previewContactMerge } from "@/services/contacts/merge";

export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/merge/preview?a=<survivor>&b=<duplicate>
 *
 * Counts what a merge would move (program enrollments, venture memberships,
 * timeline events). The counting lives in `@/services/contacts/merge`; this route
 * authenticates, gates on the capability and shapes the HTTP answer.
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const survivorCid = searchParams.get("a");
    const duplicateCid = searchParams.get("b");
    if (!survivorCid || !duplicateCid)
      return NextResponse.json(
        { success: false, error: "a and b required" },
        { status: 400 },
      );

    const summary = await previewContactMerge(duplicateCid);

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
