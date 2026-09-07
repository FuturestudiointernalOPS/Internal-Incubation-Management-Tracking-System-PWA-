/**
 * Venture-facing notifications + email (Phase 4).
 *
 * ONE helper for Venture-facing events (submission reviewed, milestone
 * completed, Venture-facing session scheduled). It:
 *   1. Creates in-app founder notifications (same stream founders already see)
 *   2. Sends each founder an email through the existing provider abstraction
 *      (Gmail via googleapis / Resend fallback — configured centrally in
 *      lib/email.js; never a second email system)
 *
 * Internal staff events must NOT be routed through this helper — it is only
 * for events explicitly designated Venture-facing.
 */
import { sendEmail } from "@/lib/email";

/**
 * @param {object} db   db handle
 * @param {object} opts
 *   dbId         — internal ventures(id) UUID of the Venture
 *   title        — in-app notification title (founders)
 *   message      — in-app notification body (founders)
 *   emailSubject — email subject line
 *   emailLines   — array of plain-text lines rendered into the email body
 */
export async function notifyAndEmailVentureFounders(db, { dbId, title, message, emailSubject, emailLines = [] }) {
  // In-app founder notifications (existing stream).
  try {
    const { notifyVentureFounders } = await import("@/lib/ventures");
    await notifyVentureFounders(dbId, title, message);
  } catch (_) {}

  // Venture-facing email to founders via the centralized provider.
  let sent = 0;
  try {
    const vRes = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [dbId] });
    const code = vRes.rows?.[0]?.venture_id;
    if (!code) return { sent: 0 };

    const fRes = await db.execute({
      sql: `SELECT DISTINCT c.email, c.name
            FROM venture_members vm
            JOIN contacts c ON (c.cid = vm.contact_id OR c.cid = vm.user_cid)
            WHERE vm.venture_id = ? AND vm.member_type = 'founder'
              AND vm.removed_at IS NULL AND c.email IS NOT NULL`,
      args: [code],
    });

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      ${(emailLines || []).map((l) => `<p style="margin:8px 0;color:#334155;font-size:15px;line-height:1.5">${l}</p>`).join("")}
      <p style="margin:22px 0 0;color:#94a3b8;font-size:12px">ImpactOS · Future Studio</p>
    </div>`;

    for (const f of fRes.rows || []) {
      try {
        const r = await sendEmail({ to: f.email, subject: emailSubject, html });
        if (r && r.success !== false) sent += 1;
      } catch (_) {}
    }
  } catch (_) {}
  return { sent };
}
