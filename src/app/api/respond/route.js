import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const { cid, form_id, answers, publicData, group_name } = await req.json();

    if (!form_id || (!answers && !publicData)) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    let resolvedCid = cid;
    let confidence_score = 100;
    let match_status = 'auto';
    let resolvedGroupName = group_name;

    if (!resolvedGroupName) {
      const formRes = await db.execute({
        sql: "SELECT group_name FROM forms WHERE form_id = ?",
        args: [form_id]
      });
      if (formRes.rows.length > 0) {
        resolvedGroupName = formRes.rows[0].group_name;
      }
    }

    if (!resolvedCid && publicData) {
      const emailMatch = await db.execute({
        sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?)",
        args: [publicData.email || '']
      });
      if (emailMatch.rows.length > 0) {
        resolvedCid = emailMatch.rows[0].cid;
        confidence_score = 100;
      } 
      else if (publicData.phone) {
        const phoneMatch = await db.execute({
          sql: "SELECT cid FROM contacts WHERE phone = ?",
          args: [publicData.phone]
        });
        if (phoneMatch.rows.length > 0) {
          resolvedCid = phoneMatch.rows[0].cid;
          confidence_score = 95;
        }
      }
      
      if (!resolvedCid && publicData.name) {
        const nameMatch = await db.execute({
          sql: "SELECT cid FROM contacts WHERE LOWER(name) LIKE LOWER(?)",
          args: [`%${publicData.name}%`]
        });
        if (nameMatch.rows.length > 0) {
          resolvedCid = nameMatch.rows[0].cid;
          confidence_score = 70;
        }
      }

      if (!resolvedCid && publicData.email) {
         resolvedCid = "USER_" + Math.random().toString(36).substring(2, 8).toUpperCase();
         await db.execute({
           sql: "INSERT INTO contacts (cid, name, email, phone, group_name) VALUES (?, ?, ?, ?, ?)",
           args: [resolvedCid, publicData.name || 'Anonymous', publicData.email, publicData.phone || null, resolvedGroupName || null]
         });
         confidence_score = 100;
      }
    }

    if (confidence_score < 90) match_status = 'flagged';

    await db.execute({
      sql: "INSERT INTO form_responses (form_id, cid, answers, confidence_score, match_status, group_name) VALUES (?, ?, ?, ?, ?, ?)",
      args: [form_id, resolvedCid || null, JSON.stringify({...answers, ...publicData}), confidence_score, match_status, resolvedGroupName || null]
    });


    if (resolvedCid) {
      const hasYes = Object.values(answers || {}).some(v => v === 'Yes' || String(v).toLowerCase() === 'yes' || v === true);
      const hasNo = Object.values(answers || {}).some(v => v === 'No' || String(v).toLowerCase() === 'no' || v === false);
      let status = 'responded';
      if (hasYes) status = 'yes';
      else if (hasNo) status = 'no';

      await db.execute({
        sql: `UPDATE campaign_contacts 
              SET status = ? 
              WHERE cid = ? AND campaign_id IN (SELECT id FROM campaigns WHERE form_id = ?)`,
        args: [status, resolvedCid, form_id]
      });
    }

    return NextResponse.json({ success: true, message: "Response recorded", confidence_score, match_status });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
