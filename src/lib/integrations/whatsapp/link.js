/**
 * Click-to-chat links — the zero-integration path.
 *
 * `wa.me` opens WhatsApp (app or web) with the number and the text already
 * filled in. The message is sent by a person from their own phone, so nothing
 * is billed, no template approval is needed, and no server credential is used.
 *
 * The text is always editable by the sender: the link must never look like the
 * platform sent something the person did not choose to send.
 */

import { normalizeWhatsappPhone } from "./phone";

/**
 * Build a `https://wa.me/…` link, or null when the number is not a valid
 * international number. A null link is what the UI turns into a disabled
 * action with the reason, never into a link to a wrong number.
 */
export function buildWhatsappLink({ phone, countryCode, message }) {
  const normalized = normalizeWhatsappPhone(phone, countryCode);
  if (!normalized) return null;

  const base = `https://wa.me/${normalized.digits}`;
  const text = String(message || "").trim();
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
