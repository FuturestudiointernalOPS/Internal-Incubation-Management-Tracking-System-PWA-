import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deleteCampaignCascade } from "@/models/communications";
import { loadCampaignDetail, updateCampaignDefinition } from "@/services/communications/campaigns";

// ── CAMPAIGNS RETIRED ──────────────────────────────────────────────────────
// Campaigns are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
const RETIRED = true;
const RETIRED_RESPONSE = NextResponse.json(
  { success: false, error: "Campaigns are retired and no longer accessible." },
  { status: 403 },
);

export async function GET(req, { params }) {
  if (RETIRED) return RETIRED_RESPONSE;
  try {
    const { id } = await params;
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;

    // Campaign info + steps (with delivery counts) + contacts
    const campaign = await loadCampaignDetail(id);

    if (!campaign)
      return NextResponse.json(
        { success: false, error: "errors.notFound" },
        { status: 404 },
      );

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req, { params }) {
  if (RETIRED) return RETIRED_RESPONSE;
  try {
    const { id } = await params;
    const data = await req.json();
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;

    // Update main info, steps and target audience
    await updateCampaignDefinition(id, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req, { params }) {
  if (RETIRED) return RETIRED_RESPONSE;
  try {
    const { id } = await params;
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;

    await deleteCampaignCascade(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
