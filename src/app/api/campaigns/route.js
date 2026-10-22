import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { retiredRouteResponse } from "@/server/http/refusal";
import { listCampaignsWithStats } from "@/models/communications";
import { createCampaign } from "@/services/communications/campaigns";

// ── CAMPAIGNS RETIRED ──────────────────────────────────────────────────────
// Campaigns are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
// No role list: a retired path refuses every authenticated identity alike, and
// each hit is logged so the route can be deleted once traffic proves it dead.
const RETIRED = true;

export const GET = createHandler(async () => {
  if (RETIRED) return retiredRouteResponse("campaigns");
  const result = await listCampaignsWithStats();
  return NextResponse.json({ success: true, campaigns: result.rows });
});

export const POST = createHandler(async (req) => {
  if (RETIRED) return retiredRouteResponse("campaigns");
  const data = await req.json();
  const { name, form_id, cids, steps } = data;

  if (!name)
    return NextResponse.json(
      { success: false, error: "Name is required" },
      { status: 400 },
    );

  // Insert the campaign, its step sequence and its target contacts
  const campaign_id = await createCampaign({ name, formId: form_id, steps, cids });

  return NextResponse.json({ success: true, campaign_id });
});
