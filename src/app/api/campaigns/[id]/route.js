import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { retiredRouteResponse } from "@/server/http/refusal";
import { deleteCampaignCascade } from "@/models/communications";
import { loadCampaignDetail, updateCampaignDefinition } from "@/services/communications/campaigns";

// ── CAMPAIGNS RETIRED ──────────────────────────────────────────────────────
// Campaigns are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
// No role list: a retired path refuses every authenticated identity alike, and
// each hit is logged so the route can be deleted once traffic proves it dead.
const RETIRED = true;

export const GET = createHandler(async (req, { params }) => {
  if (RETIRED) return retiredRouteResponse("campaigns/[id]");
  const { id } = await params;

  // Campaign info + steps (with delivery counts) + contacts
  const campaign = await loadCampaignDetail(id);

  if (!campaign)
    return NextResponse.json(
      { success: false, error: "errors.notFound" },
      { status: 404 },
    );

  return NextResponse.json({ success: true, campaign });
});

export const PUT = createHandler(async (req, { params }) => {
  if (RETIRED) return retiredRouteResponse("campaigns/[id]");
  const { id } = await params;
  const data = await req.json();

  // Update main info, steps and target audience
  await updateCampaignDefinition(id, data);

  return NextResponse.json({ success: true });
});

export const DELETE = createHandler(async (req, { params }) => {
  if (RETIRED) return retiredRouteResponse("campaigns/[id]");
  const { id } = await params;

  await deleteCampaignCascade(id);

  return NextResponse.json({ success: true });
});
