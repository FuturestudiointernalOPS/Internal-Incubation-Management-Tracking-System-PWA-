import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await initDb();
    const result = await db.execute(`
      SELECT c.*, 
             COUNT(cc.id) as total_contacts,
             SUM(CASE WHEN cc.status = 'sent' THEN 1 ELSE 0 END) as sent_contacts
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
    const { name, form_id, cids } = data; 
    
    if (!name) return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });

    // Insert Campaign
    const campaignResult = await db.execute({
      sql: "INSERT INTO campaigns (name, form_id, status) VALUES (?, ?, 'pending') RETURNING id",
      args: [name, form_id || null]
    });
    
    const campaignId = campaignResult.rows[0].id;
    
    // Insert Contacts
    if (cids && cids.length > 0) {
      const queries = cids.map(cid => ({
        sql: "INSERT INTO campaign_contacts (campaign_id, cid, status) VALUES (?, ?, 'pending')",
        args: [campaignId, cid]
      }));
      await db.batch(queries);
    }
    
    return NextResponse.json({ success: true, campaignId, contactsAdded: cids?.length || 0 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
