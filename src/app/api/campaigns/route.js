import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { insertCampaign, listCampaignsWithStats } from "@/models/communications";
import { addCampaignSteps, addCampaignContacts } from "@/services/communications/campaigns";

// ── CAMPAIGNS RETIRED ──────────────────────────────────────────────────────
// Campaigns are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
const RETIRED = true;
const RETIRED_RESPONSE = NextResponse.json(
  { success: false, error: "Campaigns are retired and no longer accessible." },
  { status: 403 },
);

export const GET = createHandler({ roles: ["staff", "super_admin"] }, async () => {
  if (RETIRED) return RETIRED_RESPONSE;
  const result = await listCampaignsWithStats();
  return NextResponse.json({ success: true, campaigns: result.rows });
});

export const POST = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {
  if (RETIRED) return RETIRED_RESPONSE;
  const data = await req.json();
  const { name, form_id, cids, steps } = data;

  if (!name)
    return NextResponse.json(
      { success: false, error: "Name is required" },
      { status: 400 },
    );

  // Insert Campaign
  const result = await insertCampaign(name, form_id);
  const campaign_id = result.rows[0].id;

  // Insert Steps (The Sequence)
  await addCampaignSteps(campaign_id, steps);

  // Insert Target Contacts
  await addCampaignContacts(campaign_id, cids);

  return NextResponse.json({ success: true, campaign_id });
});
