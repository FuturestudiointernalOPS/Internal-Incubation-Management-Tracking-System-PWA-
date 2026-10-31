/**
 * WhatsApp inbound — replies, delivery statuses, and the STOP keyword.
 *
 * Meta calls one webhook for everything: a person's reply, and the delivery
 * status of a message we sent. Both must be recorded, and a STOP must actually
 * withdraw consent — a number that keeps messaging someone who said stop gets
 * reported, and reports are what get a business number restricted.
 *
 * The route is public (Meta holds no session). Its credential is the HMAC
 * signature, verified in the route BEFORE anything here runs. This module only
 * decides what a verified payload means; the statements live in
 * `@/models/contacts/whatsapp`.
 */

import {
  findContactByPhoneDigits,
  insertWhatsappLog,
  updateWhatsappLogStatus,
} from "@/models/contacts/whatsapp";
import { whatsappNumberVariants } from "@/lib/integrations/whatsapp/phone";
import { withdrawWhatsappConsent, WHATSAPP_CONSENT_SOURCES } from "./whatsappConsent";

/**
 * The whole message must BE the keyword (accent- and punctuation-insensitive).
 * Matching a substring would turn "stop by tomorrow" into an opt-out.
 */
const STOP_KEYWORDS = new Set([
  "stop",
  "stopmessages",
  "unsubscribe",
  "optout",
  "arreter",
  "desabonner",
  "desinscrire",
]);

/** Normalize and compare; only an exact keyword counts. */
export function isWhatsappOptOutMessage(text) {
  const normalized = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return STOP_KEYWORDS.has(normalized);
}

/** The human-readable text of any message type that can carry one. */
function messageText(message) {
  const candidates = [
    message?.text?.body,
    message?.button?.text,
    message?.interactive?.button_reply?.title,
    message?.interactive?.list_reply?.title,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}

/** The provider's reason for a failed status, if any. */
function statusError(status) {
  const first = status?.errors?.[0];
  if (!first) return null;
  return (
    first.error_data?.details ||
    first.title ||
    first.message ||
    (first.code != null ? String(first.code) : null)
  );
}

async function handleInboundMessage(message, summary) {
  const from = String(message?.from || "").replace(/\D/g, "");
  const variants = whatsappNumberVariants(from);

  let contact = null;
  if (variants.length > 0) {
    const found = await findContactByPhoneDigits(variants);
    contact = found.rows?.[0] || null;
  }

  const text = messageText(message);
  const optedOut = isWhatsappOptOutMessage(text);

  if (optedOut && contact?.cid) {
    await withdrawWhatsappConsent(contact.cid, WHATSAPP_CONSENT_SOURCES.STOP);
    summary.optOuts += 1;
  }

  await insertWhatsappLog({
    contactCid: contact?.cid || null,
    direction: "inbound",
    messageType: message?.type || "text",
    status: optedOut ? "opt_out" : "received",
    providerMessageId: message?.id || null,
    recipient: from || null,
    sentAt: new Date(),
  });

  summary.messages += 1;
}

/**
 * Apply one verified webhook payload.
 *
 * Idempotency: the provider message id is unique in the log, so Meta's retries
 * cannot double-record a message or a status. A single malformed entry never
 * discards the rest of the batch.
 *
 * Returns `{ messages, statuses, optOuts }` — used by the route's tests and by
 * anyone diagnosing a delivery.
 */
export async function handleWhatsappWebhookPayload(payload) {
  const summary = { messages: 0, statuses: 0, optOuts: 0 };
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value || {};

      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        try {
          await handleInboundMessage(message, summary);
        } catch (error) {
          console.warn("[WhatsApp Inbound] message skipped:", error.message);
        }
      }

      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        if (!status?.id || !status?.status) continue;
        try {
          await updateWhatsappLogStatus(status.id, status.status, statusError(status));
          summary.statuses += 1;
        } catch (error) {
          console.warn("[WhatsApp Inbound] status skipped:", error.message);
        }
      }
    }
  }

  return summary;
}
