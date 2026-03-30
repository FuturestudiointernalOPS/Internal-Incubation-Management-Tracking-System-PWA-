import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  try {
    await initDb();
    
    // Find pending contacts and their current step requirements
    const result = await db.execute(`
      SELECT cc.id as cc_id, cc.cid, cc.campaign_id, cc.sequence_step,
             c.email, c.name, cam.name as campaign_name, cam.form_id,
             cs.subject as step_subject, cs.body as step_body, cs.delay_days
      FROM campaign_contacts cc
      JOIN contacts c ON cc.cid = c.cid
      JOIN campaigns cam ON cc.campaign_id = cam.id
      JOIN campaign_steps cs ON cc.campaign_id = cs.campaign_id AND cc.sequence_step = cs.step_order
      WHERE cc.status = 'pending' 
      AND (cc.next_send_at IS NULL OR datetime(cc.next_send_at) <= datetime('now'))
      AND cam.status != 'paused'
      LIMIT 10
    `);

    console.log(`[AUTOMATION] Found ${result.rows.length} pending contacts for dispatch.`);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "No pending emails" });
    }

    let auth, gmail;
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN) {
      auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI || "https://developers.google.com/oauthplayground"
      );
      auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
      gmail = google.gmail({ version: "v1", auth });
    }

    const sendEmailViaGmailApi = async (to, subject, content) => {
      const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/html; charset=utf-8",
        "",
        content
      ].join("\n");
    
      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedMessage }
      });
    };

    let sentCount = 0;
    
    for (const row of result.rows) {
      const formUrl = row.form_id ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/form/${row.form_id}?cid=${row.cid}` : '';
      
      // Personalize Content
      let subject = row.step_subject || `Message from ImpactOS`;
      let body = row.step_body || `Hello, please check your portal.`;

      const personalizedBody = body
        .replace(/{{name}}/g, row.name)
        .replace(/{{campaign}}/g, row.campaign_name)
        .replace(/{{link}}/g, formUrl);

      const htmlContent = `
          <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <p style="font-size: 11px; letter-spacing: 0.2em; color: #6366f1; font-weight: 900; text-transform: uppercase; margin-bottom: 24px;">Secure Communication Channel</p>
            <div style="font-size: 16px; color: #334155; line-height: 1.8; white-space: pre-wrap;">${personalizedBody}</div>
            
            ${formUrl ? `
              <div style="margin: 40px 0; text-align: center;">
                <a href="${formUrl}" style="display: inline-block; padding: 18px 36px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 14px; font-weight: 900; letter-spacing: 0.05em; font-size: 13px; text-transform: uppercase; box-shadow: 0 10px 20px rgba(99,102,241,0.2);">Proceed to Secure Portal</a>
              </div>
            ` : ''}
            
            <p style="margin-top: 50px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 25px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">Electronic Dispatch ID: ${row.cid} · ImpactOS Executive Core</p>
          </div>
        `;

      try {
        if (gmail) {
           await sendEmailViaGmailApi(row.email, subject, htmlContent);
        } else {
           console.log("[MOCK SEND] Email prepared for:", row.email, "Subject:", subject);
        }
        
        // 1. Identify the NEXT step in the sequence
        const nextStepResult = await db.execute({
           sql: "SELECT * FROM campaign_steps WHERE campaign_id = ? AND step_order = ?",
           args: [row.campaign_id, row.sequence_step + 1]
        });

        if (nextStepResult.rows.length > 0) {
           const ns = nextStepResult.rows[0];
           
           // 2. Calculate the next dispatch window correctly
           if (ns.wait_type === 'date' && ns.scheduled_date) {
              // Fixed Date/Time logic
              await db.execute({
                sql: `UPDATE campaign_contacts SET sequence_step = sequence_step + 1, next_send_at = ?, status = 'pending' WHERE id = ?`,
                args: [ns.scheduled_date, row.cc_id]
              });
           } else {
              // Dynamic Delay logic (Minutes/Hours/Days)
              const unit = ns.wait_type || 'days';
              const val = unit === 'minutes' ? (ns.delay_minutes || 0) : (unit === 'hours' ? (ns.delay_hours || 0) : (ns.delay_days || 0));
              const window = `+${val} ${unit}`;
              
              await db.execute({
                sql: `UPDATE campaign_contacts SET sequence_step = sequence_step + 1, next_send_at = datetime('now', ?), status = 'pending' WHERE id = ?`,
                args: [window, row.cc_id]
              });
           }
        } else {
           // Sequence complete
           await db.execute({
             sql: `UPDATE campaign_contacts SET status = 'completed', next_send_at = NULL WHERE id = ?`,
             args: [row.cc_id]
           });
        }
        sentCount++;
      } catch (err) {
        console.error("Failed to send email to", row.email, err);
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err) {
    console.error("Automation Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
