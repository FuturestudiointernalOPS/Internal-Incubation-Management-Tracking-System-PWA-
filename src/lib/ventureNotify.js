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
import { sendStandaloneEmail } from "@/lib/email";

/**
 * @param {object} db   db handle
 * @param {object} opts
 *   dbId         — internal ventures(id) UUID of the Venture
 *   title        — in-app notification title (founders)
 *   message      — in-app notification body (founders)
 *   emailSubject — email subject line
 *   emailLines   — array of plain-text lines rendered into the email body
 *   context      — optional entity context for the drill-down inbox
 *                  ({ journey_stage_id, milestone_id, task_id, session_id })
 *   templateKey/params/dedupeKey — i18n-able event identity + idempotency
 *                  (additive; title/message remain the display fallback)
 */
export async function notifyAndEmailVentureFounders(db, { dbId, title, message, emailSubject, emailLines = [], context = {}, templateKey = null, params = null, dedupeKey = null }) {
  // In-app founder notifications (existing stream).
  try {
    const { notifyVentureFounders } = await import("@/lib/ventures");
    await notifyVentureFounders(dbId, title, message, context, { templateKey, params, dedupeKey });
  } catch (_) {}

  // Venture-facing email to founders via the centralized provider.
  let sent = 0;
  try {
    const ventureResult = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [dbId] });
    const code = ventureResult.rows?.[0]?.venture_id;
    if (!code) return { sent: 0 };

    const foundersResult = await db.execute({
      sql: `SELECT DISTINCT c.cid, c.email, c.name
            FROM venture_members vm
            JOIN contacts c ON (c.cid = vm.contact_id OR c.cid = vm.user_cid)
            WHERE vm.venture_id = ? AND vm.member_type = 'founder'
              AND vm.removed_at IS NULL AND c.email IS NOT NULL`,
      args: [code],
    });

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      ${(emailLines || []).map((line) => `<p style="margin:8px 0;color:#334155;font-size:15px;line-height:1.5">${line}</p>`).join("")}
      <p style="margin:22px 0 0;color:#94a3b8;font-size:12px">ImpactOS · Future Studio</p>
    </div>`;

    for (const founder of foundersResult.rows || []) {
      try {
        const sendResult = await sendStandaloneEmail({ to: founder.email, subject: emailSubject, html, contact_cid: founder.cid, email_type: "venture_notification" });
        if (sendResult && sendResult.success !== false) sent += 1;
      } catch (_) {}
    }
  } catch (_) {}
  return { sent };
}

/**
 * Coach delivery (Vinance 3 — Phase 1): notify ONE platform user (contact)
 * in-app + by email about a Venture session they are attached to as coach.
 * Coach may be Future Studio staff or an invited external contact. Degrades
 * gracefully when the contact cannot be resolved.
 */
export async function notifyVentureCoach(db, { dbId, coachContactId, title, message, emailSubject, emailLines = [], context = {}, templateKey = null, params = null, dedupeKey = null }) {
  try {
    if (!coachContactId) return { sent: 0, skipped: true };
    const contactResult = await db.execute({
      sql: "SELECT cid, name, email FROM contacts WHERE cid = ? AND (deleted = 0 OR deleted IS NULL) LIMIT 1",
      args: [String(coachContactId)],
    });
    const contact = contactResult.rows?.[0];
    if (!contact) return { sent: 0, skipped: true };

    const { createVentureNotification } = await import("@/lib/ventures");
    await createVentureNotification({
      recipient_id: contact.cid,
      title,
      message,
      context: { ...(context || {}), venture_id: dbId },
      templateKey,
      params,
      dedupeKey,
    });

    if (!contact.email) return { sent: 0 };
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      ${(emailLines || []).map((line) => `<p style="margin:8px 0;color:#334155;font-size:15px;line-height:1.5">${line}</p>`).join("")}
      <p style="margin:22px 0 0;color:#94a3b8;font-size:12px">ImpactOS · Future Studio</p>
    </div>`;
    const sendResult = await sendStandaloneEmail({ to: contact.email, subject: emailSubject, html, contact_cid: contact.cid, email_type: "venture_notification" });
    return { sent: sendResult && sendResult.success !== false ? 1 : 0 };
  } catch (_) {
    return { sent: 0 };
  }
}

/**
 * Lead Manager delivery (A8): notify EVERY active Lead Manager of a Venture
 * (venture_staff_assignments.responsibility_code = 'lead_manager') about a
 * Venture session they are attached to — in-app + email, same channel as the
 * coach. Lead Managers are internal staff, so delivery does not depend on the
 * venture_facing flag. A recipient whose contact/email cannot be resolved still
 * gets the in-app notification (only the email is skipped), and one failing
 * recipient never stops the others.
 *
 * excludeCids: recipients to leave out — the actor who triggered the event and
 * the session coach (both already notified by their own channel).
 */
export async function notifyVentureLeadManagers(db, { dbId, ventureCode, title, message, emailSubject, emailLines = [], context = {}, templateKey = null, params = null, dedupeKey = null, excludeCids = [] }) {
  try {
    // venture_staff_assignments is keyed on the Venture code (VNT-…). When the
    // caller does not carry it, resolve it from the internal id the same way
    // the founder helper does.
    let code = ventureCode || null;
    if (!code && dbId) {
      const ventureResult = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [dbId] });
      code = ventureResult.rows?.[0]?.venture_id || null;
    }
    if (!code) return { sent: 0, skipped: true };

    const leadManagersResult = await db.execute({
      sql: `SELECT staff_contact_id FROM venture_staff_assignments
            WHERE venture_id = ? AND responsibility_code = 'lead_manager' AND status = 'active'`,
      args: [code],
    });

    const excluded = new Set((excludeCids || []).filter(Boolean).map((excludeCid) => String(excludeCid)));
    const seen = new Set();
    let sent = 0;

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      ${(emailLines || []).map((line) => `<p style="margin:8px 0;color:#334155;font-size:15px;line-height:1.5">${line}</p>`).join("")}
      <p style="margin:22px 0 0;color:#94a3b8;font-size:12px">ImpactOS · Future Studio</p>
    </div>`;

    for (const row of leadManagersResult.rows || []) {
      const cid = row?.staff_contact_id ? String(row.staff_contact_id) : null;
      if (!cid || excluded.has(cid) || seen.has(cid)) continue;
      seen.add(cid);
      // Isolated per recipient: one bad row never blocks the rest.
      try {
        const contactResult = await db.execute({
          sql: "SELECT cid, name, email FROM contacts WHERE cid = ? AND (deleted = 0 OR deleted IS NULL) LIMIT 1",
          args: [cid],
        });
        const contact = contactResult.rows?.[0];
        if (!contact) continue;

        const { createVentureNotification } = await import("@/lib/ventures");
        await createVentureNotification({
          recipient_id: contact.cid,
          title,
          message,
          context: { ...(context || {}), venture_id: dbId },
          templateKey,
          params,
          // Role suffix keeps the Lead Manager copy distinct from the founder
          // copy of the same event for a dual-role recipient.
          dedupeKey: dedupeKey ? `${dedupeKey}:lm` : null,
        });

        if (!contact.email) continue;
        const sendResult = await sendStandaloneEmail({ to: contact.email, subject: emailSubject, html, contact_cid: contact.cid, email_type: "venture_notification" });
        if (sendResult && sendResult.success !== false) sent += 1;
      } catch (_) {}
    }
    return { sent };
  } catch (_) {
    return { sent: 0 };
  }
}
