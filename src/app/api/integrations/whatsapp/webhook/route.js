import crypto from "crypto";
import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import {
  whatsappAppSecret,
  whatsappVerifyToken,
} from "@/lib/integrations/whatsapp/config";
import { handleWhatsappWebhookPayload } from "@/services/communications/whatsappInbound";

export const dynamic = "force-dynamic";

/**
 * WHATSAPP WEBHOOK — Meta's only way in.
 *
 * GET  the verification handshake: Meta echoes `hub.verify_token` and expects
 *      `hub.challenge` back, verbatim.
 * POST replies and delivery statuses. The caller is Meta, which holds no
 *      session, so the HMAC signature is the credential. It is verified over
 *      the RAW body — parsing first would make the signature unverifiable.
 *
 * Fail closed: with no app secret or verify token configured, both methods
 * refuse rather than accept unauthenticated payloads.
 *
 * Idempotency lives in the service (the provider message id is unique).
 */

function safeEqual(left, right) {
  try {
    const a = Buffer.from(String(left || ""), "utf8");
    const b = Buffer.from(String(right || ""), "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

export async function GET(req) {
  const verifyToken = whatsappVerifyToken();
  if (!verifyToken) {
    return new NextResponse("WhatsApp webhook is not configured", { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge") || "";

  if (mode === "subscribe" && safeEqual(token, verifyToken)) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req) {
  const appSecret = whatsappAppSecret();
  if (!appSecret) {
    return new NextResponse("WhatsApp webhook is not configured", { status: 503 });
  }

  const rawBody = await req.text();
  const received = req.headers.get("x-hub-signature-256") || "";
  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  if (!safeEqual(received, expected)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (_) {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  try {
    await initDb();
    await handleWhatsappWebhookPayload(payload);
  } catch (error) {
    // A retry is desirable for a transient failure, so this is a 500 on purpose.
    console.error("[WhatsApp Webhook] processing failed:", error.message);
    return new NextResponse("Processing failed", { status: 500 });
  }

  return NextResponse.json({ success: true });
}
