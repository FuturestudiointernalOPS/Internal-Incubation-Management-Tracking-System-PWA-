/**
 * Activation / access email for the platform approval rule.
 *
 * Picks the right template for the account state, reuses a still-valid setup
 * token when one exists (so a retry does not pile up token rows) and records
 * the outcome on the CRM timeline.
 */

import {
  decideEmailKind,
  ensurePasswordSetupTokensSchema,
  getTemplate,
  sendInviteEmail,
  sendLoginEmail,
  sendTrackedEmail,
} from "@/lib/email";
import { hashToken } from "@/lib/token-hashing";
import { writeCrmTimeline } from "../crmHelpers";

const KIND_NOTES = {
  create_activate: "New account activation email",
  activate_existing: "Existing account activation email",
  login_existing: "Existing user login email",
};

/**
 * @returns {Promise<void>}
 */
export async function sendActivationEmail({
  db,
  ctx,
  contact,
  contactEmail,
  contactName,
  targetRole,
  groupName,
  accountExists,
  accountActivated,
  forceResend,
}) {
  const emailKind = decideEmailKind({ accountExists, accountActivated });
  const activationTemplate = getTemplate(ctx.form?.settings, "activation", ctx.run?.settings);
  const existingUserTemplate = getTemplate(ctx.form?.settings, "existing_user", ctx.run?.settings);
  const templateVars = {
    organization: "ImpactOS",
    form_name: ctx.run?.name || "",
    group_name: groupName || "",
    name: contactName,
  };

  // For setup emails, reuse a still-valid unused token when one exists
  // so retries do not create unnecessary token records.
  let existingToken = null;
  if (emailKind !== "login_existing") {
    try {
      const tokRes = await db.execute({
        sql: "SELECT token FROM password_setup_tokens WHERE contact_cid = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
        args: [contact.cid],
      });
      if (tokRes.rows.length > 0) existingToken = tokRes.rows[0].token;
    } catch (_) {}
  }

  const tracked = await sendTrackedEmail({
    submission_id: ctx.submission?.id || null,
    contact_cid: contact.cid,
    email_type: "activation",
    note: KIND_NOTES[emailKind],
    to: contactEmail,
    batch_id: forceResend ? `manual_resend_${ctx.submission?.id || "bulk"}_${Date.now()}` : undefined,
    sendFn: async () => {
      if (emailKind === "login_existing") {
        return sendLoginEmail({
          to: contactEmail,
          name: contactName,
          role: targetRole,
          template: existingUserTemplate,
          templateVars,
        });
      }
      // Setup email: reuse the existing valid token or create one.
      const token =
        existingToken ||
        "act_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      if (!existingToken) {
        // Repair environments where password_setup_tokens.used was
        // created as BOOLEAN — otherwise the INSERT below throws
        // "column 'used' is boolean but expression is of type integer"
        // and the activation email is recorded as failed.
        await ensurePasswordSetupTokensSchema();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");
        await db.execute({
          sql: `INSERT INTO password_setup_tokens (contact_cid, token, token_hash, expires_at, used) VALUES (?, ?, ?, ?, 0)`,
          args: [contact.cid, token, hashToken(token), expiresAt],
        });
        console.log("[Automation] Token stored for", contactEmail);
      }
      return sendInviteEmail({
        to: contactEmail,
        name: contactName,
        role: targetRole,
        token,
        template: activationTemplate,
        templateVars,
      });
    },
  });

  if (tracked.success) {
    console.log(
      "[Automation]",
      emailKind === "login_existing" ? "Access email sent to" : "Activation email sent to",
      contactEmail
    );
    await writeCrmTimeline(contact.cid, "activation_sent",
      emailKind === "login_existing"
        ? "Access email sent with platform login link"
        : "Activation email sent with password setup link",
      "forms", ctx.submission?.id || null, "system", {});
  } else if (tracked.skipped) {
    console.log("[Automation] Activation/access email already sent — skipped", contactEmail);
  } else {
    console.error("[Automation] Activation email FAILED for", contactEmail);
    await writeCrmTimeline(contact.cid, "activation_email_failed",
      "Activation email failed to send", "forms", ctx.submission?.id || null, "system", {});
  }
}
