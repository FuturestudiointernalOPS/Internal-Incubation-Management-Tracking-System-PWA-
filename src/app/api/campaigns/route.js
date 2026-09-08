import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { insertCampaign, listCampaignsWithStats } from "@/models/communications";

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
  const res = await insertCampaign(name, form_id);
  const campaign_id = res.rows[0].id;

  // Insert Steps (The Sequence)
  if (steps && steps.length > 0) {
    const stepQueries = steps.map((s, idx) => {
      const delay_hours =
        (s.wait_type === "days" ? (s.delay_days || 0) * 24 : 0) +
        (s.wait_type === "hours" ? s.delay_hours || 0 : 0) +
        Math.round((s.wait_type === "minutes" ? s.delay_minutes || 0 : 0) / 60);
      return {
        sql: "INSERT INTO campaign_steps (campaign_id, step_order, subject, body, delay_hours) VALUES (?, ?, ?, ?, ?)",
        args: [campaign_id, idx, s.subject, s.body, delay_hours],
      };
    });
    await db.batch(stepQueries);
  }

  // Insert Target Contacts
  if (cids && cids.length > 0) {
    const contactQueries = cids.map((cid) => ({
      sql: "INSERT INTO campaign_contacts (campaign_id, contact_cid, status) VALUES (?, ?, 'pending')",
      args: [campaign_id, cid],
    }));
    await db.batch(contactQueries);
  }

  return NextResponse.json({ success: true, campaign_id });
});
