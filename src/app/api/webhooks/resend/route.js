import { NextResponse } from "next/server";
import crypto from "crypto";
import { recordResendEvent } from "@/lib/email";

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

    const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    const signedContent = `${svixId}.${svixTs}.${raw}`;
    const expected = crypto
      .createHmac("sha256", Buffer.from(secretKey, "base64"))
      .update(signedContent)
      .digest("base64");
    const signatures = svixSig.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
    if (!signatures.includes(expected)) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
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
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
