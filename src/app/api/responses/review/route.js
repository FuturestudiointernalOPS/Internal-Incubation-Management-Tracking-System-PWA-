import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const { response_id, cid } = await req.json();

    if (!response_id || !cid) return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });

    await db.execute({
      sql: "UPDATE form_responses SET cid = ?, match_status = 'resolved' WHERE id = ?",
      args: [cid, response_id]
    });

    const responseData = await db.execute({
      sql: "SELECT answers, form_id FROM form_responses WHERE id = ?",
      args: [response_id]
    });

    if (responseData.rows.length > 0) {
       const form_id = responseData.rows[0].form_id;
       const answers = JSON.parse(responseData.rows[0].answers || "{}");

       const hasYes = Object.values(answers).some(v => v === 'Yes' || String(v).toLowerCase() === 'yes' || v === true);
       const hasNo = Object.values(answers).some(v => v === 'No' || String(v).toLowerCase() === 'no' || v === false);
       let status = 'responded';
       if (hasYes) status = 'yes';
       else if (hasNo) status = 'no';

       await db.execute({
         sql: `UPDATE campaign_contacts 
               SET status = ? 
               WHERE cid = ? AND campaign_id IN (SELECT id FROM campaigns WHERE form_id = ?)`,
         args: [status, cid, form_id]
       });
    }

    return NextResponse.json({ success: true, message: "Manually matched successfully." });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
