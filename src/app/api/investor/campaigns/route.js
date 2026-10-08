import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import {
  listCampaignsForViewer,
  createCampaign,
  updateCampaignAndNotify,
} from "@/services/investor";

/**
 * GET /api/investor/campaigns
 * List fundraising campaigns. Optional query params: venture_id, status.
 */
export async function GET(req) {
  try {
    await initDb();
    // Phase 1.5: authentication only — scoping is derived in the service.
    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    const status = searchParams.get("status");

    const result = await listCampaignsForViewer({
      ventureId,
      status,
      session: await getSession(),
    });

    return NextResponse.json({ success: true, campaigns: result.campaigns });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/investor/campaigns
 * Create a new fundraising campaign. Super admin only.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const result = await createCampaign(await req.json());
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, campaign: result.campaign });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/investor/campaigns
 * Update campaign status or details. Super admin only.
 */
export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const result = await updateCampaignAndNotify(await req.json());
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, campaign: result.campaign });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
