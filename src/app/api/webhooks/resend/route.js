import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { processResendWebhook } from "@/services/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend
 *
 * Resend lifecycle webhook (Svix-signed). Each event is APPENDED to the email
 * log so the full timeline (Sent → Delivered → Opened → Clicked, or
 * Sent → Bounced, etc.) is preserved, while the latest row drives the
 * current status. Events are matched by Resend's email_id — never by recipient
 * — so two emails to the same address stay distinct.
 *
 * The signature check, the freshness window and the event → status map live in
 * `@/services/email`; this boundary only reads the secret, the headers and the
 * raw body, and shapes the response.
 */
export async function POST(req) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, error: "Webhook secret not configured" }, { status: 500 });
    }

    const result = await processResendWebhook({
      secret,
      svixId: req.headers.get("svix-id"),
      svixTs: req.headers.get("svix-timestamp"),
      svixSig: req.headers.get("svix-signature") || "",
      raw: await req.text(),
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    if (result.ignored) {
      return NextResponse.json({ success: true, ignored: true });
    }

    return NextResponse.json({
      success: true,
      recorded: result.recorded,
      status: result.emailStatus,
      email_id: result.email_id,
    });
  } catch (error) {
    return serverError(error, { log: "[resend webhook]" });
  }
}
