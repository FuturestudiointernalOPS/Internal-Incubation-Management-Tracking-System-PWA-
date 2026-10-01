import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/email-utils";
import { defaultPaymentProvider } from "@/lib/integrations/payments";
import {
  getRegistrationByReference,
  normalizeRegistrationEmail,
  providerAmountOf,
  setEmailState,
  setPaymentHint,
} from "@/lib/lms/registrations";
import {
  findResumableRegistration,
  getCheckoutStateForPayer,
  issueResumeLink,
  mintAccessLinkForPayer,
  prepareAccessDelivery,
  resolveCheckoutCourse,
  resolveResumeToken,
} from "@/lib/lms/checkout";
import { deliverCheckoutEmail } from "@/lib/lms/checkoutMail";
import { settleVerifiedPayment } from "@/services/lms/checkout";

export const dynamic = "force-dynamic";

/**
 * PUBLIC CHECKOUT — the payer's own tab, and the way back.
 *
 * GET  ?reference=&email=            the two states (payment / access), plus
 *                                    whether the short window is still open.
 *                                    NEVER the reference back, never a link.
 * POST { action: "hint" }            a transaction id the BROWSER reported —
 *                                    an INDICATION only, it grants nothing.
 * POST { action: "verify" }          the payer's own tab asking us to re-ask
 *                                    the PROVIDER: same two guarantees as the
 *                                    notification (server-side verification +
 *                                    amount match), so a missed or delayed
 *                                    Kkiapay notification cannot leave a paid
 *                                    registration stuck on "pending".
 * POST { action: "access" }          mint the access link, INSIDE the short
 *                                    window after payment; past it the answer
 *                                    is "check your email".
 * POST { action: "resend" }          the fallback door: email the right one-time
 *                                    link (resume payment, or finish access).
 *                                    Always a neutral 200.
 * POST { action: "continue" }        resolve an emailed resume token into the
 *                                    payment context for an existing
 *                                    registration — the ONLY path that lets an
 *                                    existing reference reach a browser, and
 *                                    only through a token we emailed.
 *
 * Rate limits are keyed on the REFERENCE (and the email), never on the IP
 * alone: in Benin a whole mobile network, campus or cybercafé shares one
 * outbound address, and two people paying at once must not throttle each other.
 */
export async function GET(req) {
  try {
    await initDb();

    const { searchParams } = new URL(req.url);
    const reference = String(searchParams.get("reference") || "").trim();
    const email = normalizeEmail(searchParams.get("email"));
    if (!reference || !email) {
      return NextResponse.json({ success: false, error: "lms.errors.registrationNotFound" }, { status: 400 });
    }

    const limited = enforceRateLimit(req, `checkout-state:${reference}`, {
      limit: 200,
      windowMs: 30 * 60 * 1000,
    });
    if (limited) return limited;

    const state = await getCheckoutStateForPayer({ reference, email });
    if (!state) {
      return NextResponse.json({ success: false, error: "lms.errors.registrationNotFound" }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    console.error("[checkout state]", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "hint") return await handleHint(req, body);
    if (action === "verify") return await handleVerify(req, body);
    if (action === "access") return await handleAccess(req, body);
    if (action === "resend") return await handleResend(req, body);
    if (action === "continue") return await handleContinue(req, body);

    return NextResponse.json({ success: false, error: "lms.errors.invalidAction" }, { status: 400 });
  } catch (error) {
    console.error("[checkout action]", error);
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { status: 500 });
  }
}

/** The browser's own report. Useful, never decisive — it cannot grant access. */
async function handleHint(req, body) {
  const reference = String(body.reference || "").trim();
  const transactionId = body.transactionId ? String(body.transactionId) : null;
  if (!reference || !transactionId) {
    return NextResponse.json({ success: false, error: "lms.errors.invalidPayload" }, { status: 400 });
  }

  const limited = enforceRateLimit(req, `checkout-hint:${reference}`, {
    limit: 60,
    windowMs: 30 * 60 * 1000,
  });
  if (limited) return limited;

  const registration = await getRegistrationByReference(reference);
  if (!registration) {
    return NextResponse.json({ success: false, error: "lms.errors.registrationNotFound" }, { status: 404 });
  }
  // Never overwrite an id that was already verified or recorded by the provider.
  if (!registration.provider_transaction_id) {
    await setPaymentHint(registration.id, {
      transactionId,
      partnerId: registration.partner_id || reference,
    });
  }
  return NextResponse.json({ success: true, recorded: true });
}

/**
 * The payer's own tab asking US to re-ask the PROVIDER.
 *
 * The Kkiapay notification is the primary path, but it can be missed — Kkiapay
 * retries only a handful of times, and a sandbox, a deploy or a network blip can
 * swallow it. The payer, though, holds a successful transaction id from the
 * widget and their browser is already polling. So here we re-verify SERVER-side,
 * by that id, and settle the registration if the money is confirmed.
 *
 * It grants NOTHING on a claim: the provider's verified answer decides, and the
 * amount is checked against the price WE decided — the same two guarantees the
 * notification path relies on. A payment that is real therefore stops being
 * stuck on "en cours".
 */
async function handleVerify(req, body) {
  const reference = String(body.reference || "").trim();
  const email = normalizeEmail(body.email);
  if (!reference || !email) {
    return NextResponse.json({ success: false, error: "lms.errors.invalidPayload" }, { status: 400 });
  }

  const limited = enforceRateLimit(req, `checkout-verify:${reference}`, {
    limit: 120,
    windowMs: 30 * 60 * 1000,
  });
  if (limited) return limited;

  const registration = await getRegistrationByReference(reference);
  if (
    !registration ||
    normalizeRegistrationEmail(registration.email) !== normalizeRegistrationEmail(email)
  ) {
    return NextResponse.json({ success: false, error: "lms.errors.registrationNotFound" }, { status: 404 });
  }

  if (registration.status === "paid") {
    return NextResponse.json({ success: true, payment: "paid" });
  }

  // The widget's success callback reports its transaction id with this action;
  // keep it as the trace the notification would otherwise have carried.
  const hintedTransactionId = body.transactionId ? String(body.transactionId) : null;
  if (hintedTransactionId && !registration.provider_transaction_id) {
    await setPaymentHint(registration.id, {
      transactionId: hintedTransactionId,
      partnerId: registration.partner_id || reference,
    });
    registration.provider_transaction_id = hintedTransactionId;
  }

  // Nothing to ask about: no notification and no browser report means no id.
  // The person may simply not have paid yet — leave it pending.
  const transactionId = registration.provider_transaction_id;
  if (!transactionId) {
    return NextResponse.json({ success: true, payment: registration.status });
  }

  const provider = defaultPaymentProvider();
  if (!provider.canVerifyTransaction()) {
    return NextResponse.json({ success: true, payment: registration.status });
  }

  const verified = await provider.verifyTransaction(transactionId);
  if (!verified.ok || !verified.isSuccess) {
    // Not settled yet, or a transient outage. Leave it pending; the next poll
    // (or the notification, or the sweep) tries again.
    return NextResponse.json({ success: true, payment: registration.status, verified: false });
  }

  // The amount check, the mark-paid, the access step and the receipt are the
  // shared settlement (also used by the Kkiapay notification), so the two paths
  // cannot diverge.
  const settled = await settleVerifiedPayment({
    registration,
    provider,
    verified,
    eventType: "verify",
    journalTransactionId: transactionId,
    journalPartnerId: verified.partnerId,
    journalAmount: verified.amount,
  });

  if (!settled.ok) {
    return NextResponse.json({ success: true, payment: registration.status });
  }

  return NextResponse.json({
    success: true,
    payment: "paid",
    access: settled.fulfillment.ok ? "granted" : "failed",
  });
}

/** The link is handed over ONLY while the moment is fresh. */
async function handleAccess(req, body) {
  const reference = String(body.reference || "").trim();
  const email = normalizeEmail(body.email);
  if (!reference || !email) {
    return NextResponse.json({ success: false, error: "lms.errors.invalidPayload" }, { status: 400 });
  }

  const limited = enforceRateLimit(req, `checkout-access:${reference}`, {
    limit: 30,
    windowMs: 30 * 60 * 1000,
  });
  if (limited) return limited;

  const result = await mintAccessLinkForPayer({ reference, email });
  if (!result.ok) {
    const status = result.error === "lms.errors.registrationNotFound" ? 404 : 409;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }
  if (!result.served) {
    // Past the window, or no link to serve: the email is the door.
    return NextResponse.json({ success: true, served: false, emailed: true });
  }
  return NextResponse.json({ success: true, served: true, url: result.url });
}

/**
 * The fallback door. The answer is ALWAYS the same shape, whether or not a
 * registration exists, so the endpoint cannot be used to discover emails.
 */
async function handleResend(req, body) {
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ success: false, error: "lms.errors.registrationEmailInvalid" }, { status: 400 });
  }

  const byEmail = enforceRateLimit(req, `checkout-resend:email:${email}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (byEmail) return byEmail;
  const byIp = enforceRateLimit(req, `checkout-resend:ip:${getClientIp(req)}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (byIp) return byIp;

  const neutral = NextResponse.json({ success: true });

  const registration = await findResumableRegistration({
    email,
    courseId: body.courseId || null,
  });
  if (!registration) return neutral;

  let delivery;
  if (registration.status === "paid") {
    const { accessToken } = await prepareAccessDelivery(registration);
    delivery = await deliverCheckoutEmail({ registration, accessToken });
  } else {
    const resumeToken = await issueResumeLink(registration);
    delivery = await deliverCheckoutEmail({ registration, resumeToken });
  }

  await setEmailState(registration.id, { status: delivery.sent ? "sent" : "failed" });
  return neutral;
}

/**
 * The ONLY path that hands an EXISTING reference to a browser — and only to the
 * holder of a token we emailed. A paid registration is pushed to the access
 * door instead: nobody is ever invited to pay twice.
 */
async function handleContinue(req, body) {
  const token = String(body.token || "").trim();
  if (!token) {
    return NextResponse.json({ success: false, error: "lms.errors.invalidPayload" }, { status: 400 });
  }

  const limited = enforceRateLimit(req, `checkout-continue:ip:${getClientIp(req)}`, {
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const registration = await resolveResumeToken(token);
  if (!registration) {
    return NextResponse.json({ success: false, error: "lms.errors.resumeLinkInvalid" }, { status: 410 });
  }

  const provider = defaultPaymentProvider();
  const course = registration.course_id ? await resolveCheckoutCourse(registration.course_id) : null;

  // Already paid: there is nothing to pay, only an access to finish.
  if (registration.status === "paid") {
    return NextResponse.json({
      success: true,
      paid: true,
      reference: registration.reference,
      email: registration.email,
    });
  }

  return NextResponse.json({
    success: true,
    paid: false,
    reference: registration.reference,
    email: registration.email,
    amount: providerAmountOf(registration),
    display_amount: registration.amount,
    currency: registration.currency,
    status: registration.status,
    course: { title: course?.title || "" },
    payment: { ...provider.publicConfig(), configured: provider.isConfigured() },
  });
}
