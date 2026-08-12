/**
 * IMPACTOS EMAIL SERVICE
 *
 * Uses Resend for transactional emails (invites, activation, password reset).
 * Replace with your own sender domain/email in RESEND_FROM_EMAIL.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@impactos.futurestudio.bj";
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const APP_URL = (typeof rawAppUrl === "string" ? rawAppUrl : "http://localhost:3000").replace(/\/login.*$/i, "").replace(/\/$/, "");

// ─── TEMPLATE ENGINE ────────────────────────────────────────────────

const DEFAULT_TEMPLATES = {
  acknowledgement: {
    subject: "Thank you for your submission — {{form_name}}",
    body: `<p>Hello {{name}},</p><p>We have received your submission for <strong>{{form_name}}</strong>.</p><p>Our team will review it and get back to you soon.</p>`,
  },
  approval: {
    subject: "Your {{form_name}} application has been approved",
    body: `<p>Congratulations {{name}}!</p><p>Your application for <strong>{{form_name}}</strong> has been approved.</p><p>We are excited to welcome you.</p>`,
  },
  rejection: {
    subject: "Update on your {{form_name}} application",
    body: `<p>Dear {{name}},</p><p>Thank you for your interest in <strong>{{form_name}}</strong>.</p><p>Unfortunately, you were not selected this time. We encourage you to apply again in the future.</p>`,
  },
  activation: {
    subject: "Welcome to {{organization}} — Set Your Password",
    body: `<p>Hello {{name}},</p><p>Your account has been created on <strong>{{organization}}</strong>.</p><p>Click the button below to create your password and access your dashboard.</p>`,
  },
};

/**
 * Replace {{variables}} in a template string with provided values.
 * Falls back gracefully for missing values.
 */
export function applyTemplate(text, vars = {}) {
  if (!text) return "";
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val != null ? String(val) : "");
  }
  return result;
}

/**
 * Resolve a template from form settings, falling back to defaults.
 */
export function getTemplate(formSettings, templateKey) {
  const custom = formSettings?.automation?.templates?.[templateKey];
  const def = DEFAULT_TEMPLATES[templateKey];
  return {
    subject: custom?.subject || def?.subject || "",
    body: custom?.body || def?.body || "",
  };
}

/**
 * Send an invite email with activation link
 */
export async function sendInviteEmail({ to, name, role, token, template, templateVars }) {
  const activationUrl = `${APP_URL}/activate?token=${token}`;
  const roleLabel = role?.replace(/_/g, " ") || "User";
  const org = templateVars?.organization || "ImpactOS";
  const tv = { name: name || "there", role: roleLabel, activation_link: activationUrl, organization: org, ...(templateVars || {}) };

  // Use template subject if provided, otherwise default
  const subject = template?.subject
    ? applyTemplate(template.subject, tv)
    : `You're invited to ${org} — Set Your Password`;

  // Template body or default
  const bodyHtml = template?.body
    ? applyTemplate(template.body, tv)
    : `<p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">Hi <strong style="color: #f8fafc;">${tv.name}</strong>,</p>
       <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">You've been invited to join ${org} as a <strong style="color: #ff6600;">${roleLabel}</strong>. Click the button below to set your password and activate your account.</p>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="480" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 40px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">${subject}</h2>
              ${bodyHtml}

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${activationUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      ACTIVATE ACCOUNT
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                This link expires in <strong style="color: #f8fafc;">48 hours</strong>.
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="color: #ff6600; font-size: 11px; word-break: break-all; margin: 0 0 24px;">
                ${activationUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not expect this invitation, please ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to, subject: `You're invited to ImpactOS — ${roleLabel}`, html });
}

/**
 * Send a welcome email after activation
 */
export async function sendWelcomeEmail({ to, name, role }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="480" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 40px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">Welcome, ${name}! 👋</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Your account is now active. You can log in and start using ImpactOS.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${APP_URL}/login" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      LOG IN
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not create this account, please contact your administrator.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to, subject: "Welcome to ImpactOS — Your account is active", html });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="480" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 40px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">Reset your password</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Hi <strong style="color: #f8fafc;">${name}</strong>, we received a request to reset your password.
                Click the button below to set a new one.
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${resetUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      RESET PASSWORD
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                This link expires in <strong style="color: #f8fafc;">48 hours</strong>.
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If you didn't request this, you can safely ignore this email.
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not request a password reset, please ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to, subject: "Reset your ImpactOS password", html });
}

/**
 * Send a venture approval email (venture created via invite link has been approved).
 * Includes a setup link so the founder can set their password and access the dashboard.
 */
export async function sendVentureApprovalEmail({ to, name, ventureName, setupUrl }) {
  const ctaUrl = setupUrl || `${APP_URL}/login`;
  const ctaLabel = setupUrl ? "SET YOUR PASSWORD" : "LOG IN";
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="480" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 40px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ff6600;">Impact</span><span style="color: #f8fafc;">OS</span>
              </h1>
              <p style="color: #64748b; font-size: 13px; margin: 0 0 24px;">Future Studio Platform</p>

              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">Your venture has been approved! 🎉</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                Hi <strong style="color: #f8fafc;">${name}</strong>,
              </p>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Great news — your venture <strong style="color: #ff6600;">${ventureName}</strong> has been
                <strong style="color: #f8fafc;">approved</strong> and is now active on Venture OS.
                ${setupUrl ? "Set your password below to access your dashboard." : "You can log in and start building."}
              </p>

              <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;">
                    <a href="${ctaUrl}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              ${setupUrl ? `
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                This link expires in <strong style="color: #f8fafc;">48 hours</strong>.
              </p>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 4px;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="color: #ff6600; font-size: 11px; word-break: break-all; margin: 0 0 24px;">
                ${ctaUrl}
              </p>` : ""}

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
              <p style="color: #475569; font-size: 11px; line-height: 1.5; margin: 0;">
                If you have any questions, please contact your administrator.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to, subject: `Your venture ${ventureName} has been approved`, html });
}

/**
 * Internal: sends email via Resend
 */
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn("Resend not configured — skipping email to:", to, "subject:", subject);
    return { success: false, note: "Resend API key not configured" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (e) {
    console.error("Email send error:", e);
    return { success: false, error: e.message };
  }
}

// ─── EMAIL DELIVERY LOG (idempotency layer) ─────────────────────────
// Every workflow email is tracked in platform_email_log so the system
// never sends the same email type twice for the same submission, and
// failed sends are distinguishable from successful ones.

async function ensureEmailLogTable() {
  try {
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS platform_email_log (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER,
      contact_cid TEXT,
      email_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_once
      ON platform_email_log (submission_id, email_type)
      WHERE status = 'sent'`);
    return true;
  } catch (e) {
    console.warn("[EmailLog] Could not ensure table:", e.message);
    return false;
  }
}

export async function getEmailLogRow(submissionId, emailType) {
  if (!submissionId) return null;
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const res = await db.execute({
      sql: "SELECT * FROM platform_email_log WHERE submission_id = ? AND email_type = ? ORDER BY id DESC LIMIT 1",
      args: [parseInt(submissionId), emailType],
    });
    return res.rows[0] || null;
  } catch (_) {
    return null;
  }
}

async function recordEmailResult({ submission_id, contact_cid, email_type, success, error }) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    if (success) {
      await db.execute({
        sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, sent_at)
              VALUES (?, ?, ?, 'sent', NOW())
              ON CONFLICT (submission_id, email_type) WHERE status = 'sent' DO NOTHING`,
        args: [submission_id ? parseInt(submission_id) : null, contact_cid || null, email_type],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, error)
              VALUES (?, ?, ?, 'failed', ?)`,
        args: [submission_id ? parseInt(submission_id) : null, contact_cid || null, email_type, (error || "Unknown error").substring(0, 500)],
      });
    }
  } catch (e) {
    console.warn("[EmailLog] Could not record:", e.message);
  }
}

/**
 * Send a workflow email exactly once per (submission_id, email_type).
 * - Already sent → returns { skipped: true } without sending
 * - Send succeeds → records 'sent' and returns { success: true }
 * - Send fails → records 'failed' and returns { success: false } (retryable)
 */
export async function sendTrackedEmail({ submission_id, contact_cid, email_type, sendFn }) {
  const existing = await getEmailLogRow(submission_id, email_type);
  if (existing && existing.status === "sent") {
    return { skipped: true, already_sent: true, log: existing };
  }

  let result;
  try {
    result = await sendFn();
  } catch (e) {
    result = { success: false, error: e?.message || "Send failed" };
  }

  await recordEmailResult({
    submission_id,
    contact_cid,
    email_type,
    success: !!result.success,
    error: result.error ? (typeof result.error === "string" ? result.error : JSON.stringify(result.error)) : undefined,
  });

  return { ...result, skipped: false };
}

/**
 * Email delivery stats for a form (dashboard visibility).
 */
export async function getEmailStatsForForm(formId) {
  try {
    await ensureEmailLogTable();
    const { default: db } = await import("@/lib/db");
    const res = await db.execute({
      sql: `SELECT el.email_type, el.status, COUNT(*)::int AS cnt
            FROM platform_email_log el
            JOIN platform_form_submissions s ON el.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE r.form_id = ?
            GROUP BY el.email_type, el.status`,
      args: [parseInt(formId)],
    });
    const stats = { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
    for (const row of res.rows) {
      if (row.status === "sent") stats.sent += row.cnt;
      if (row.status === "failed") stats.failed += row.cnt;
      if (row.status === "pending") stats.pending += row.cnt;
      if (row.status === "sent" && row.email_type === "activation") stats.activation_sent += row.cnt;
      if (row.status === "sent" && row.email_type === "approval") stats.approval_sent += row.cnt;
    }
    return stats;
  } catch (_) {
    return { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
  }
}

/**
 * Send a decision notification email to an applicant
 */
export async function sendDecisionEmail({ to, applicantName, formName, decision, comment, orgName, template, templateVars }) {
  const tv = { name: applicantName || "there", form_name: formName || "application", organization: orgName || "Future Studio", decision, comment: comment || "", ...(templateVars || {}) };
  const decisionLabel = decision === "approved" ? "approved" : decision === "rejected" ? "not selected to proceed" : "being reviewed";

  const subject = template?.subject
    ? applyTemplate(template.subject, tv)
    : decision === "approved"
      ? `Your ${formName || "application"} has been approved`
      : decision === "rejected"
        ? `Update on your ${formName || "application"}`
        : `Additional information needed — ${formName || "application"}`;

  const commentBlock = comment ? `<p style="margin:16px 0 0;font-size:14px;color:#cbd5e1;font-style:italic;border-left:3px solid #f97316;padding-left:12px;">"${comment}"</p>` : "";

  const bodyHtml = template?.body
    ? applyTemplate(template.body, tv)
    : `<p style="margin:0 0 8px;font-size:15px;color:#e2e8f0;">Hello ${tv.name},</p><p style="margin:0 0 8px;font-size:14px;color:#94a3b8;line-height:1.6;">Your ${tv.form_name} has been <strong style="color:#f8fafc;">${decisionLabel}</strong>.</p>${commentBlock}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="480" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 40px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 800;">${subject}</h1>
              ${bodyHtml}
              <p style="margin:24px 0 0;font-size:12px;color:#64748b;">
                ${orgName || "Future Studio"} — This is an automated notification.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;

  return sendEmail({ to, subject, html });
}
