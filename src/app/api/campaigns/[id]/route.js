import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    await initDb();
    
    // Get Campaign Info
    const campaignRes = await db.execute({
      sql: `SELECT c.*, 
                   COUNT(cc.id) as total_contacts,
                   SUM(CASE WHEN cc.status = 'completed' OR cc.sequence_step > 0 THEN 1 ELSE 0 END) as sent_contacts
            FROM campaigns c
            LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
            WHERE c.id = ?
            GROUP BY c.id`,
      args: [id]
    });
    
    if (!campaignRes.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    const campaign = campaignRes.rows[0];
    
    // Get Steps
    const stepsRes = await db.execute({
      sql: "SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order",
      args: [id]
    });
    
    // Get Contacts
    const contactsRes = await db.execute({
      sql: "SELECT * FROM campaign_contacts WHERE campaign_id = ?",
      args: [id]
    });

    return NextResponse.json({ 
      success: true, 
      campaign: {
        ...campaign,
        steps: stepsRes.rows,
        contacts: contactsRes.rows
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const data = await req.json();
    await initDb();

    // Update main info
    await db.execute({
      sql: "UPDATE campaigns SET name = ?, form_id = ? WHERE id = ?",
      args: [data.name, data.form_id || null, id]
    });

    // Update steps
    if (data.steps) {
      await db.execute({ sql: "DELETE FROM campaign_steps WHERE campaign_id = ?", args: [id] });
      const stepQueries = data.steps.map((s, idx) => ({
        sql: "INSERT INTO campaign_steps (campaign_id, step_order, subject, body, delay_days, delay_minutes, delay_hours, specific_time, scheduled_date, wait_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          id, 
          idx, 
          s.subject, 
          s.body, 
          s.wait_type === 'days' ? (s.delay_days || 0) : 0,
          s.wait_type === 'minutes' ? (s.delay_minutes || 0) : 0,
          s.wait_type === 'hours' ? (s.delay_hours || 0) : 0,
          s.specific_time || null,
          s.wait_type === 'date' ? s.scheduled_date : null,
          s.wait_type || 'days'
        ]
      }));
      await db.batch(stepQueries);
    }

    // Update contacts (Target Audience)
    if (data.cids) {
      // For simplicity, we'll keep existing sent records and only sync pending/new ones
      // 1. Get existing contact IDs
      const existingRes = await db.execute({ sql: "SELECT cid FROM campaign_contacts WHERE campaign_id = ?", args: [id] });
      const existingCids = existingRes.rows.map(r => r.cid);

      // 2. Identities to add
      const toAdd = data.cids.filter(cid => !existingCids.includes(cid));
      if (toAdd.length > 0) {
        let nextSendAt = new Date().toISOString();
        const step0 = data.steps?.[0];
        if (step0 && step0.wait_type === 'date' && step0.scheduled_date) nextSendAt = new Date(step0.scheduled_date).toISOString();
        
        const addQueries = toAdd.map(cid => ({
          sql: "INSERT INTO campaign_contacts (campaign_id, cid, status, sequence_step, next_send_at) VALUES (?, ?, 'pending', 0, ?)",
          args: [id, cid, nextSendAt]
        }));
        await db.batch(addQueries);
      }

      // 3. Identities to remove (only if they aren't 'sent' yet)
      const toRemove = existingCids.filter(cid => !data.cids.includes(cid));
      if (toRemove.length > 0) {
         await db.execute({
           sql: `DELETE FROM campaign_contacts WHERE campaign_id = ? AND cid IN (${toRemove.map(() => '?').join(',')}) AND status != 'sent'`,
           args: [id, ...toRemove]
         });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    await initDb();
    
    await db.batch([
      { sql: "DELETE FROM campaigns WHERE id = ?", args: [id] },
      { sql: "DELETE FROM campaign_steps WHERE campaign_id = ?", args: [id] },
      { sql: "DELETE FROM campaign_contacts WHERE campaign_id = ?", args: [id] }
    ]);
    
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
