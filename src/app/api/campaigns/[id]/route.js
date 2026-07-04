import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;

    // Get Campaign Info
    const campaignRes = await db.execute({
      sql: `SELECT c.*,
                   COUNT(cc.id) as total_contacts,
                   SUM(CASE WHEN cc.status != 'pending' THEN 1 ELSE 0 END) as sent_contacts
            FROM campaigns c
            LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
            WHERE c.id = ?
            GROUP BY c.id`,
      args: [id],
    });

    if (!campaignRes.rows[0])
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    const campaign = campaignRes.rows[0];

    // 1. Get individual Step Logic
    const stepsRes = await db.execute({
      sql: "SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order",
      args: [id],
    });

    // 2. Get Step-by-Step Delivery Counts
    const contactsRes = await db.execute({
      sql: "SELECT contact_cid, status FROM campaign_contacts WHERE campaign_id = ?",
      args: [id],
    });

    const nonPendingCount = contactsRes.rows.filter(
      (c) => c.status !== "pending",
    ).length;

    const stepsWithCounts = stepsRes.rows.map((step) => {
      return { ...step, delivered_count: nonPendingCount };
    });

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        steps: stepsWithCounts,
        contacts: contactsRes.rows,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const data = await req.json();
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;

    // Update main info
    await db.execute({
      sql: "UPDATE campaigns SET name = ?, form_id = ? WHERE id = ?",
      args: [data.name, data.form_id || null, id],
    });

    // Update steps
    if (data.steps) {
      await db.execute({
        sql: "DELETE FROM campaign_steps WHERE campaign_id = ?",
        args: [id],
      });
      const stepQueries = data.steps.map((s, idx) => {
        const delay_hours =
          (s.wait_type === "days" ? (s.delay_days || 0) * 24 : 0) +
          (s.wait_type === "hours" ? s.delay_hours || 0 : 0) +
          Math.round((s.wait_type === "minutes" ? s.delay_minutes || 0 : 0) / 60);
        return {
          sql: "INSERT INTO campaign_steps (campaign_id, step_order, subject, body, delay_hours) VALUES (?, ?, ?, ?, ?)",
          args: [id, idx, s.subject, s.body, delay_hours],
        };
      });
      await db.batch(stepQueries);
    }

    // Update contacts (Target Audience)
    if (data.cids) {
      // For simplicity, we'll keep existing sent records and only sync pending/new ones
      // 1. Get existing contact IDs
      const existingRes = await db.execute({
        sql: "SELECT contact_cid FROM campaign_contacts WHERE campaign_id = ?",
        args: [id],
      });
      const existingCids = existingRes.rows.map((r) => r.contact_cid);

      // 2. Identities to add
      const toAdd = data.cids.filter((cid) => !existingCids.includes(cid));
      if (toAdd.length > 0) {
        const addQueries = toAdd.map((cid) => ({
          sql: "INSERT INTO campaign_contacts (campaign_id, contact_cid, status) VALUES (?, ?, 'pending')",
          args: [id, cid],
        }));
        await db.batch(addQueries);
      }

      // 3. Identities to remove (only if they aren't 'sent' yet)
      const toRemove = existingCids.filter((cid) => !data.cids.includes(cid));
      if (toRemove.length > 0) {
        await db.execute({
          sql: `DELETE FROM campaign_contacts WHERE campaign_id = ? AND contact_cid IN (${toRemove.map(() => "?").join(",")}) AND status != 'sent'`,
          args: [id, ...toRemove],
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req, { params }) {
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
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
