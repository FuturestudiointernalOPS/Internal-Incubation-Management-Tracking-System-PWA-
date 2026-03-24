import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await initDb();
    
    const campaignsResult = await db.execute(`
      SELECT 
        c.id, c.name,
        COUNT(cc.id) as total,
        SUM(CASE WHEN cc.status = 'yes' THEN 1 ELSE 0 END) as yes_count,
        SUM(CASE WHEN cc.status = 'no' THEN 1 ELSE 0 END) as no_count,
        SUM(CASE WHEN cc.status = 'responded' THEN 1 ELSE 0 END) as other_responses,
        SUM(CASE WHEN cc.status = 'sent' THEN 1 ELSE 0 END) as pending_response,
        SUM(CASE WHEN cc.status = 'pending' THEN 1 ELSE 0 END) as unsent
      FROM campaigns c
      LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    
    const responsesResult = await db.execute(`
      SELECT fr.*, c.email, c.name, f.name as form_name 
      FROM form_responses fr
      LEFT JOIN contacts c ON fr.cid = c.cid
      LEFT JOIN forms f ON fr.form_id = f.form_id
      ORDER BY fr.created_at DESC
    `);

    const campaignContactsResult = await db.execute(`
      SELECT cc.campaign_id, cc.cid, cc.status, c.name, c.email
      FROM campaign_contacts cc
      JOIN contacts c ON cc.cid = c.cid
    `);

    const flaggedResult = await db.execute(`
      SELECT fr.id as response_id, fr.answers, fr.confidence_score, fr.created_at, fr.cid, c.email, c.name, f.name as form_name 
      FROM form_responses fr
      LEFT JOIN contacts c ON fr.cid = c.cid
      LEFT JOIN forms f ON fr.form_id = f.form_id
      WHERE fr.match_status = 'flagged'
      ORDER BY fr.created_at DESC
    `);

    const responsesParsed = responsesResult.rows.map(r => ({ ...r, answers: JSON.parse(r.answers) }));
    const flaggedParsed = flaggedResult.rows.map(r => ({ ...r, answers: JSON.parse(r.answers) }));

    return NextResponse.json({ 
      success: true, 
      campaignStats: campaignsResult.rows,
      detailedResponses: responsesParsed,
      contactsDetailed: campaignContactsResult.rows,
      flaggedResponses: flaggedParsed
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
