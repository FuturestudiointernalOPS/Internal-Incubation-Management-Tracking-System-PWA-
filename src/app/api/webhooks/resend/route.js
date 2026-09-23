import { NextResponse } from "next/server";
import crypto from "crypto";
import { recordResendEvent } from "@/lib/email";
import { serverError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

// Resend event type → ImpactOS email status.
const EVENT_STATUS = {
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
const MAX_SIGNATURE_AGE_SECONDS = 300;

/**
 * Verify a Svix-signed payload. The header carries one or more space-separated
 * `version,signature` candidates (multiple during secret rotation); ANY match
 * is a valid signature. Each comparison is constant-time so a timing side
 * channel cannot be used to forge a signature byte by byte.
 */
function verifySvixSignature({ secret, svixId, svixTs, svixSig, raw }) {
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
 * POST /api/webhooks/resend
 *
 * Resend lifecycle webhook (Svix-signed). Each event is APPENDED to the email
 * log so the full timeline (Sent → Delivered → Opened → Clicked, or
 * Sent → Bounced, etc.) is preserved, while the latest row drives the
 * current status. Events are matched by Resend's email_id — never by recipient
 * — so two emails to the same address stay distinct.
 */
export async function POST(req) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, error: "Webhook secret not configured" }, { status: 500 });
    }

    const svixId = req.headers.get("svix-id");
    const svixTs = req.headers.get("svix-timestamp");
    const svixSig = req.headers.get("svix-signature") || "";
    const raw = await req.text();
    if (!svixId || !svixTs || !svixSig) {
      return NextResponse.json({ success: false, error: "Missing signature headers" }, { status: 401 });
    }

    if (!verifySvixSignature({ secret, svixId, svixTs, svixSig, raw })) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }

    const timestampSeconds = Number.parseInt(svixTs, 10);
    if (
      !Number.isFinite(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_SIGNATURE_AGE_SECONDS
    ) {
      return NextResponse.json({ success: false, error: "Stale signature" }, { status: 401 });
    }

    const payload = JSON.parse(raw);
    const status = EVENT_STATUS[payload?.type];
    if (!status) {
      // email.received / email.scheduled and other non-lifecycle events.
      return NextResponse.json({ success: true, ignored: true });
    }

    const emailId = payload.data?.email_id;
    const reason = payload.data?.reason;
    const createdAt = payload.data?.created_at || payload.created_at;
    const ok = await recordResendEvent({ email_id: emailId, status, error: reason, createdAt });
    return NextResponse.json({ success: true, recorded: ok, status, email_id: emailId });
  } catch (error) {
    return serverError(error, { log: "[resend webhook]" });
  }
}
