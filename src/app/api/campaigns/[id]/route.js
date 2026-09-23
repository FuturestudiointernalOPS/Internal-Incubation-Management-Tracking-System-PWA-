import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  deleteCampaignContacts,
  deleteCampaignSteps,
  getCampaignContactCids,
  getCampaignContacts,
  getCampaignSteps,
  getCampaignWithCounts,
  updateCampaign,
} from "@/models/communications";

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
      const stepQueries = data.steps.map((step, stepOrder) => {
        const delay_hours =
          (step.wait_type === "days" ? (step.delay_days || 0) * 24 : 0) +
          (step.wait_type === "hours" ? step.delay_hours || 0 : 0) +
          Math.round(
            (step.wait_type === "minutes" ? step.delay_minutes || 0 : 0) / 60,
          );
        return {
          sql: "INSERT INTO campaign_steps (campaign_id, step_order, subject, body, delay_hours) VALUES (?, ?, ?, ?, ?)",
          args: [id, stepOrder, step.subject, step.body, delay_hours],
        };
      });
      await db.batch(stepQueries);
    }

    // Update contacts (Target Audience)
    if (data.cids) {
      // For simplicity, we'll keep existing sent records and only sync pending/new ones
      // 1. Get existing contact IDs
      const existingCidsResult = await getCampaignContactCids(id);
      const existingCids = existingCidsResult.rows.map((row) => row.contact_cid);

      // 2. Identities to add
      const toAdd = data.cids.filter(
        (contactCid) => !existingCids.includes(contactCid),
      );
      if (toAdd.length > 0) {
        const addQueries = toAdd.map((contactCid) => ({
          sql: "INSERT INTO campaign_contacts (campaign_id, contact_cid, status) VALUES (?, ?, 'pending')",
          args: [id, contactCid],
        }));
        await db.batch(addQueries);
      }

      // 3. Identities to remove (only if they aren't 'sent' yet)
      const toRemove = existingCids.filter(
        (contactCid) => !data.cids.includes(contactCid),
      );
      if (toRemove.length > 0) {
        await deleteCampaignContacts(id, toRemove);
      }
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

    await db.batch([
      { sql: "DELETE FROM campaigns WHERE id = ?", args: [id] },
      { sql: "DELETE FROM campaign_steps WHERE campaign_id = ?", args: [id] },
      {
        sql: "DELETE FROM campaign_contacts WHERE campaign_id = ?",
        args: [id],
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
