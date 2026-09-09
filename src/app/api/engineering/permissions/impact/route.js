import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { getProfileImpactCounts } from "@/models/authorization";

export const dynamic = "force-dynamic";

/**
 * GET /api/engineering/permissions/impact?profile_id=P
 * Impact preview: how many contacts resolve to the given access profile
 * (direct assignment + role-default holders). Read-only — used by the
 * Permission Center's pending-changes review to answer "who is affected?".
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("profile_id");
    if (!profileId) {
      return NextResponse.json(
        { success: false, error: "profile_id required" },
        { status: 400 },
      );
    }

    const impact = await getProfileImpactCounts(profileId);
    return NextResponse.json({ success: true, impact });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
