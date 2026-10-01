import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  deleteCampaignCascade,
  deleteCampaignSteps,
  getCampaignContacts,
  getCampaignSteps,
  getCampaignWithCounts,
  updateCampaign,
} from "@/models/communications";
import { addCampaignSteps, syncCampaignAudience } from "@/services/communications/campaigns";

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

    // Get Campaign Info
    const campaignResult = await getCampaignWithCounts(id);

    if (!campaignResult.rows[0])
      return NextResponse.json(
        { success: false, error: "errors.notFound" },
        { status: 404 },
      );
    const campaign = campaignResult.rows[0];

    // 1. Get individual Step Logic
    const stepsResult = await getCampaignSteps(id);

    // 2. Get Step-by-Step Delivery Counts
    const contactsResult = await getCampaignContacts(id);

    const nonPendingCount = contactsResult.rows.filter(
      (contact) => contact.status !== "pending",
    ).length;

    const stepsWithCounts = stepsResult.rows.map((step) => {
      return { ...step, delivered_count: nonPendingCount };
    });

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        steps: stepsWithCounts,
        contacts: contactsResult.rows,
      },
    });
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

    // Update main info
    await updateCampaign({ id, name: data.name, formId: data.form_id });

    // Update steps
    if (data.steps) {
      await deleteCampaignSteps(id);
      await addCampaignSteps(id, data.steps);
    }

    // Update contacts (Target Audience)
    if (data.cids) {
      await syncCampaignAudience(id, data.cids);
    }

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
