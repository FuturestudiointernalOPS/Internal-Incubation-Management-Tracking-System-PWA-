/**
 * WhatsApp Cloud API configuration.
 *
 * Two switches must BOTH be on before the platform can send on its own:
 *
 *   WHATSAPP_API_ENABLED=true      a deliberate, per-environment decision
 *   WHATSAPP_ACCESS_TOKEN          the Cloud API credential
 *   WHATSAPP_PHONE_NUMBER_ID       the sender's business number id
 *
 * The separate switch exists on purpose. Credentials appearing in an
 * environment (copied from another project, pasted for a test) must never be
 * enough to start messaging real people: turning the channel on stays an
 * explicit act. Until then, the CRM only offers click-to-chat.
 *
 * No secret is ever returned by `describeWhatsappConfig` — only whether it is
 * present.
 */

export const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

export function whatsappApiEnabled() {
  return process.env.WHATSAPP_API_ENABLED === "true";
}

export function whatsappAccessToken() {
  return process.env.WHATSAPP_ACCESS_TOKEN || "";
}

export function whatsappPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || "";
}

/** The shared secret Meta uses to sign a webhook delivery. */
export function whatsappAppSecret() {
  return process.env.WHATSAPP_APP_SECRET || "";
}

/** The value Meta must echo back on the webhook verification handshake. */
export function whatsappVerifyToken() {
  return process.env.WHATSAPP_VERIFY_TOKEN || "";
}

export function whatsappWebhookConfigured() {
  return Boolean(whatsappAppSecret() && whatsappVerifyToken());
}

export function whatsappApiConfigured() {
  return Boolean(whatsappAccessToken() && whatsappPhoneNumberId());
}

/** Hard ceiling on automated sends per rolling 24 hours. */
export function whatsappDailyCap() {
  const value = Number(process.env.WHATSAPP_DAILY_CAP);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 50;
}

/** Minimum time between two automated messages to the same person. */
export function whatsappContactCooldownHours() {
  const value = Number(process.env.WHATSAPP_CONTACT_COOLDOWN_HOURS);
  return Number.isFinite(value) && value >= 0 ? value : 24;
}

/** Default template language (Meta template locales are lowercase). */
export function whatsappTemplateLanguage() {
  return (process.env.WHATSAPP_TEMPLATE_LANGUAGE || "fr").toLowerCase();
}

/**
 * What this environment's WhatsApp setup IS, without revealing a secret.
 * `mode` tells the caller which path is actually available today.
 */
export function describeWhatsappConfig() {
  const enabled = whatsappApiEnabled();
  const configured = whatsappApiConfigured();

  return {
    mode: enabled && configured ? "api" : "link",
    api: {
      enabled,
      configured,
      missing: [
        ["WHATSAPP_ACCESS_TOKEN", whatsappAccessToken()],
        ["WHATSAPP_PHONE_NUMBER_ID", whatsappPhoneNumberId()],
      ]
        .filter(([, value]) => !value)
        .map(([name]) => name),
      apiVersion: WHATSAPP_API_VERSION,
    },
    limits: {
      dailyCap: whatsappDailyCap(),
      contactCooldownHours: whatsappContactCooldownHours(),
    },
    webhook: {
      configured: whatsappWebhookConfigured(),
      missing: [
        ["WHATSAPP_APP_SECRET", whatsappAppSecret()],
        ["WHATSAPP_VERIFY_TOKEN", whatsappVerifyToken()],
      ]
        .filter(([, value]) => !value)
        .map(([name]) => name),
    },
    defaultCountry: (process.env.WHATSAPP_DEFAULT_COUNTRY || "BJ").toUpperCase(),
  };
}
