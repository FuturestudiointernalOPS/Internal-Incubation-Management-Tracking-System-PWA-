import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { sendEmail } from "@/lib/email";
import { describeEmailConfig } from "@/lib/email/config";

export const dynamic = "force-dynamic";

/**
 * /api/engineering/email-config — WHAT IS THIS ENVIRONMENT'S MAIL SETUP?
 *
 * A send that fails leaves no trace in the UI: the workflow that called it
 * carries on, and the person is told what the code intended rather than what
 * happened. That is fine until an email does not arrive and the only way to
 * find out why was to read a secret on the host.
 *
 *   GET  → the configuration as it stands: which provider is primary and why,
 *          which credential NAMES are missing, the sender addresses, and the
 *          attachment caveat. NEVER a key, token or secret — only presence.
 *   POST → a real send through the same transport the app uses, returning the
 *          transport's own answer ({ success, provider, error }). This is the
 *          decisive check: it fails on production exactly as the app would.
 *
 * Super Admin only: it can send mail from the platform's own mailbox.
 */

async function gate() {
  return requireAuth(["super_admin"]);
}

export async function GET() {
  const authError = await gate();
  if (authError) return authError;
  return NextResponse.json({ success: true, config: describeEmailConfig() });
}

export async function POST(req) {
  const authError = await gate();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const to = String(body?.to || "").trim();
  if (!to) {
    return NextResponse.json(
      { success: false, error: "A recipient address is required." },
      { status: 400 },
    );
  }

  const result = await sendEmail({
    to,
    subject: "ImpactOS — test email",
    html: "<p>This is a test email from ImpactOS. If you can read it, the mail transport works.</p>",
  });

  // The transport's own words, verbatim: `error` is what the diagnosis needs.
  return NextResponse.json({
    success: result?.success === true,
    provider: result?.provider || null,
    error: result?.error || null,
    note: result?.note || null,
    fallbackUsed: result?.fallback_used === true,
    config: describeEmailConfig(),
  });
}
