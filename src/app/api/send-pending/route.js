import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    // Find pending contacts for first step only
    const result = await db.execute(`
      SELECT cc.id as cc_id, cc.contact_cid, cc.campaign_id,
             c.email, c.name, cam.name as campaign_name, cam.form_id,
             cs.subject as step_subject, cs.body as step_body
      FROM campaign_contacts cc
      JOIN contacts c ON cc.contact_cid = c.cid
      JOIN campaigns cam ON cc.campaign_id = cam.id
      JOIN campaign_steps cs ON cc.campaign_id = cs.campaign_id AND cs.step_order = 0
      WHERE cc.status = 'pending'
      AND cam.status != 'paused'
      LIMIT 10
    `);

    console.log(
      `[AUTOMATION] Found ${result.rows.length} pending contacts for dispatch.`,
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: "No pending emails",
      });
    }

    let sentCount = 0;

    for (const row of result.rows) {
      const formUrl = row.form_id
        ? `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/form/${row.form_id}?cid=${row.contact_cid}`
        : "";

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

            ${
              formUrl
                ? `
              <div style="margin: 40px 0; text-align: center;">
                <a href="${formUrl}" style="display: inline-block; padding: 18px 36px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 14px; font-weight: 900; letter-spacing: 0.05em; font-size: 13px; text-transform: uppercase; box-shadow: 0 10px 20px rgba(99,102,241,0.2);">Proceed to Secure Portal</a>
              </div>
            `
                : ""
            }

            <p style="margin-top: 50px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 25px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">Electronic Dispatch ID: ${row.contact_cid} · ImpactOS Executive Core</p>
          </div>
        `;

      try {
        await sendEmail({
          to: row.email,
          subject,
          body: htmlContent,
          isHtml: true,
        });

        // Single-send: mark contact as completed after sending
        await db.execute({
          sql: `UPDATE campaign_contacts SET status = 'completed', sent_at = NOW() WHERE id = ?`,
          args: [row.cc_id],
        });
        sentCount++;
      } catch (err) {
        console.error("Failed to send email to", row.email, err);
      }
    }

    return NextResponse.json({ success: true, sent: sentCount });
  } catch (err) {
    console.error("Automation Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
