/**
 * WhatsApp outbound — the automated send path, with the anti-block guards.
 *
 * This is the ONLY way the platform may send a WhatsApp message on its own.
 * Every guard below exists because a business number is a shared reputation:
 * one unchecked loop can get the number restricted for everyone.
 *
 *   1. consent + a live record + a valid number  (the shared decision)
 *   2. the channel is explicitly enabled AND configured
 *   3. a hard daily cap across all automated sends
 *   4. a per-contact cooldown
 *   5. templates only (enforced by the transport)
 *   6. every attempt is logged, so 3 and 4 can be counted
 *
 * Click-to-chat does NOT go through here: that message is typed and sent by a
 * person, and pretending otherwise would pollute the delivery log.
 */

import { logger } from "@/lib/logger";
import { evaluateWhatsappReachability } from "@/lib/integrations/whatsapp/rules";
import { sendWhatsappTemplate } from "@/lib/integrations/whatsapp/send";
import {
  whatsappApiConfigured,
  whatsappApiEnabled,
  whatsappContactCooldownHours,
  whatsappDailyCap,
  whatsappTemplateLanguage,
} from "@/lib/integrations/whatsapp/config";
import {
  countWhatsappOutboundSince,
  findWhatsappOutboundForContactSince,
  insertWhatsappLog,
} from "@/models/contacts/whatsapp";

const HOUR_MS = 60 * 60 * 1000;

const since = (hours) => new Date(Date.now() - hours * HOUR_MS).toISOString();

/**
 * Send one approved template to one contact.
 *
 * Returns `{ success, provider, messageId?, error?, skipped?, reason? }`.
 * A refusal is a value, never an exception: the caller decides how to report it.
 */
export async function sendWhatsappTemplateToContact({
  contact,
  templateName,
  languageCode,
  components,
}) {
  const recipient = evaluateWhatsappReachability(contact);
  if (!recipient.allowed) {
    return { success: false, skipped: true, reason: recipient.reason };
  }

  if (!whatsappApiEnabled() || !whatsappApiConfigured()) {
    return { success: false, error: "whatsapp_not_configured" };
  }

  const alreadySent = await countWhatsappOutboundSince(since(24));
  const sentLastDay = alreadySent.rows?.[0]?.count || 0;
  if (sentLastDay >= whatsappDailyCap()) {
    return { success: false, error: "whatsapp_daily_cap_reached" };
  }

  const cooldownHours = whatsappContactCooldownHours();
  if (cooldownHours > 0) {
    const recent = await findWhatsappOutboundForContactSince(
      contact.cid,
      since(cooldownHours),
    );
    if ((recent.rows?.length || 0) > 0) {
      return { success: false, error: "whatsapp_cooldown_active" };
    }
  }

  const started = Date.now();
  const result = await sendWhatsappTemplate({
    to: recipient.phone.e164,
    templateName,
    languageCode: languageCode || whatsappTemplateLanguage(),
    components,
  });

  await insertWhatsappLog({
    contactCid: contact.cid,
    templateName,
    status: result.success ? "sent" : "failed",
    provider: result.provider,
    providerMessageId: result.messageId || null,
    error: result.success ? null : result.error || "WhatsApp send failed",
    recipient: recipient.phone.e164,
    sentAt: result.success ? new Date() : null,
  });

  if (result.success) {
    logger.info("whatsapp_sent", {
      template: templateName,
      durationMs: Date.now() - started,
    });
  } else {
    logger.error("whatsapp_send_failed", {
      template: templateName,
      durationMs: Date.now() - started,
      error: result.error || "WhatsApp send failed",
    });
  }

  return result;
}
