import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  try {
    await initDb();
    
    // Find pending contacts
    const result = await db.execute(`
      SELECT cc.id as cc_id, cc.cid, cc.campaign_id, c.email, c.name, cam.name as campaign_name, cam.form_id
      FROM campaign_contacts cc
      JOIN contacts c ON cc.cid = c.cid
      JOIN campaigns cam ON cc.campaign_id = cam.id
      WHERE cc.status = 'pending' 
      AND (cc.next_send_at IS NULL OR cc.next_send_at <= CURRENT_TIMESTAMP)
      LIMIT 10
    `);

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
      ].join("\\n");
    
      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\\+/g, "-")
        .replace(/\\//g, "_");
    
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedMessage }
      });
    };

    let sentCount = 0;
    
    for (const row of result.rows) {
      const formUrl = row.form_id ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/form/${row.form_id}?cid=${row.cid}` : '';
      const subject = `Update: ${row.campaign_name}`;
      const content = `
          <div style="font-family: inherit; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px;">
            <p style="font-size: 14px; letter-spacing: 0.1em; color: #6366f1; font-weight: 900; text-transform: uppercase;">ImpactOS Secure Channel</p>
            <h2 style="font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 20px;">Hello ${row.name},</h2>
            <p style="font-size: 16px; color: #475569; line-height: 1.6;">You have received a formal communication request regarding the <strong>${row.campaign_name}</strong> module.</p>
            
            ${formUrl ? `
              <div style="margin: 40px 0;">
                <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 16px;">Action Required:</p>
                <a href="${formUrl}" style="display: inline-block; padding: 16px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 900; letter-spacing: 0.05em; font-size: 14px;">PROCEED TO PORTAL</a>
              </div>
            ` : ''}
            
            <p style="margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px;">This is an automated encrypted dispatch from the FutureStudio Super Admin Core. Reply tracking is active payload.</p>
          </div>
        `;

      try {
        if (gmail) {
           await sendEmailViaGmailApi(row.email, subject, content);
        } else {
           console.log("[MOCK SEND] Email prepared for:", row.email);
        }
        
        // Update to mark sent
        await db.execute({
          sql: `UPDATE campaign_contacts 
                SET sequence_step = sequence_step + 1, 
                    next_send_at = datetime('now', '+3 days'),
                    status = 'sent'
                WHERE id = ?`,
          args: [row.cc_id]
        });
        sentCount++;
      } catch (err) {
        console.error("Failed to send email to", row.email, err);
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
