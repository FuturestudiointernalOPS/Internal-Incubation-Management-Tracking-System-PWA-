import { NextResponse } from "next/server";
import crypto from "crypto";
import { markEmailBounced } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend
 *
 * Resend bounce webhook (Svix-signed). On "email.bounced" events, the most
 * recent SENT email to the bounced recipient is marked BOUNCED — the sent row
 * is kept, a bounced row becomes the latest status, and history is never
 * deleted. The Emails tab then shows it as Bounced (retryable) instead of
 * treating it as successfully delivered.
 *
 * Configure in Resend → Webhooks → add this URL; set RESEND_WEBHOOK_SECRET
 * (the whsec_... signing secret) in the environment.
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

    // Svix signature: HMAC-SHA256 over "<id>.<timestamp>.<raw body>",
    // base64-encoded; secret is "whsec_" + base64 key material.
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
    if (payload?.type === "email.bounced") {
      const tos = Array.isArray(payload.data?.to) ? payload.data.to : [];
      let marked = 0;
      for (const to of tos) {
        if (typeof to === "string" && to) {
          const ok = await markEmailBounced({ recipient: to, error: payload.data?.reason || "Bounced" });
          if (ok) marked++;
        }
      }
      return NextResponse.json({ success: true, marked });
    }

    // Other event types (delivered, opened, clicked…) are acknowledged.
    return NextResponse.json({ success: true, ignored: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
