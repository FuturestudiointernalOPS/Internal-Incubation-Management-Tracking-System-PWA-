/**
 * EMAIL service — the Resend (Svix) lifecycle webhook.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the signature
 * check (constant-time, multi-candidate during secret rotation), the freshness
 * window that stops a captured delivery from being replayed, the event → status
 * map, and the append to the delivery log. The record itself lives in
 * `@/services/email/log` (which reads `@/models/emailLogStore`). No SQL, no
 * HTTP: a refusal is a value ({ ok: false, status, error }) the HTTP boundary
 * turns into a response.
 */

import crypto from "crypto";
import { recordResendEvent } from "./log";

// Resend event type → ImpactOS email status.
export const RESEND_EVENT_STATUS = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.complained": "complained",
};

// A signature is only honoured while it is fresh, so a captured delivery cannot
// be replayed later to fake a new lifecycle event (Svix recommends 5 minutes).
export const MAX_SIGNATURE_AGE_SECONDS = 300;

/**
 * Verify a Svix-signed payload. The header carries one or more space-separated
 * `version,signature` candidates (multiple during secret rotation); ANY match
 * is a valid signature. Each comparison is constant-time so a timing side
 * channel cannot be used to forge a signature byte by byte.
 */
export function verifySvixSignature({ secret, svixId, svixTs, svixSig, raw }) {
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const expected = crypto
    .createHmac("sha256", Buffer.from(secretKey, "base64"))
    .update(`${svixId}.${svixTs}.${raw}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  return svixSig
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean)
    .some((candidate) => {
      const candidateBuffer = Buffer.from(candidate);
      return (
        candidateBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
      );
    });
}

/**
 * Turn a raw Resend webhook call into a decision: refuse a missing/invalid/stale
 * signature, ignore a non-lifecycle event, otherwise APPEND the event to the
 * delivery log (matched by Resend's email_id — never by recipient, so two
 * emails to the same address stay distinct).
 */
export async function processResendWebhook({ secret, svixId, svixTs, svixSig, raw }) {
  if (!svixId || !svixTs || !svixSig) {
    return { ok: false, status: 401, error: "Missing signature headers" };
  }

  if (!verifySvixSignature({ secret, svixId, svixTs, svixSig, raw })) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  const timestampSeconds = Number.parseInt(svixTs, 10);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_SIGNATURE_AGE_SECONDS
  ) {
    return { ok: false, status: 401, error: "Stale signature" };
  }

  const payload = JSON.parse(raw);
  const status = RESEND_EVENT_STATUS[payload?.type];
  if (!status) {
    // email.received / email.scheduled and other non-lifecycle events.
    return { ok: true, ignored: true };
  }

  const emailId = payload.data?.email_id;
  const reason = payload.data?.reason;
  const createdAt = payload.data?.created_at || payload.created_at;
  const recorded = await recordResendEvent({ email_id: emailId, status, error: reason, createdAt });

  return { ok: true, recorded, emailStatus: status, email_id: emailId };
}
