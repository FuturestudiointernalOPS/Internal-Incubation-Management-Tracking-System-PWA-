import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await initDb();
    const result = await db.execute(`
      SELECT c.*, 
             COUNT(cc.id) as total_contacts,
             SUM(CASE WHEN cc.sequence_step > 0 OR cc.status = 'completed' THEN 1 ELSE 0 END) as sent_contacts
      FROM campaigns c
      LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return NextResponse.json({ success: true, campaigns: result.rows });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const data = await req.json();
    const { name, form_id, cids, steps } = data; 
    
    if (!name) return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });

    // Insert Campaign
    const res = await db.execute({
      sql: "INSERT INTO campaigns (name, form_id, status) VALUES (?, ?, 'pending') RETURNING id",
      args: [name, form_id || null]
    });
    const campaign_id = res.rows[0].id;

    // Insert Steps (The Sequence)
    if (steps && steps.length > 0) {
      const stepQueries = steps.map((s, idx) => ({
        sql: "INSERT INTO campaign_steps (campaign_id, step_order, subject, body, delay_days, delay_minutes, delay_hours, specific_time, scheduled_date, wait_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          campaign_id, 
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
    
    // Insert Target Contacts
    if (cids && cids.length > 0) {
      // Determine initial send time from Step 0
      let nextSendAt = new Date().toISOString(); 
      let initialStatus = 'pending';
      
      const step0 = steps?.[0];
      if (step0 && step0.wait_type === 'date' && step0.scheduled_date) {
        nextSendAt = new Date(step0.scheduled_date).toISOString();
      }

      const contactQueries = cids.map(cid => ({
        sql: "INSERT INTO campaign_contacts (campaign_id, cid, status, sequence_step, next_send_at) VALUES (?, ?, ?, 0, ?)",
        args: [campaign_id, cid, initialStatus, nextSendAt]
      }));
      await db.batch(contactQueries);
    }
    
    return NextResponse.json({ success: true, campaign_id });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
