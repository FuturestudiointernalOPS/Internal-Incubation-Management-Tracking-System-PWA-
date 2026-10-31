/**
 * The WhatsApp Cloud API transport.
 *
 * One HTTPS call, template messages only. Free-form text is deliberately NOT
 * supported here: outside the 24-hour reply window WhatsApp requires a
 * pre-approved template, and a server that can send arbitrary text is a server
 * that can get the business number restricted. Human, free-form conversation
 * stays in click-to-chat, where a person is actually typing.
 *
 * The result shape mirrors the email transport (`{ success, provider, error }`)
 * so callers and tests treat both channels the same way.
 */

import {
  WHATSAPP_API_VERSION,
  whatsappAccessToken,
  whatsappApiConfigured,
  whatsappApiEnabled,
  whatsappPhoneNumberId,
  whatsappTemplateLanguage,
} from "./config";
import { normalizeWhatsappPhone } from "./phone";

function fail(error) {
  return { success: false, provider: "whatsapp", error };
}

/**
 * Send one approved template to one number.
 *
 * `to` is an E.164 number (with or without the leading `+`).
 * `languageCode` defaults to the environment's template language.
 * `components` is passed through unchanged (Meta's own template components).
 */
export async function sendWhatsappTemplate({
  to,
  templateName,
  languageCode,
  components,
}) {
  if (!whatsappApiEnabled()) return fail("whatsapp_api_disabled");
  if (!whatsappApiConfigured()) return fail("whatsapp_not_configured");
  if (!templateName) return fail("whatsapp_template_required");

  const normalized = normalizeWhatsappPhone(to);
  if (!normalized) return fail("whatsapp_invalid_phone");

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${whatsappPhoneNumberId()}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalized.digits,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode || whatsappTemplateLanguage() },
      ...(Array.isArray(components) && components.length > 0 ? { components } : {}),
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(15000) : undefined,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const reason =
        data?.error?.error_data?.details ||
        data?.error?.message ||
        `WhatsApp API responded ${response.status}`;
      return fail(reason);
    }

    return {
      success: true,
      provider: "whatsapp",
      messageId: data?.messages?.[0]?.id || null,
    };
  } catch (error) {
    return fail(error?.message || "WhatsApp API request failed");
  }
}
