import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { after } from "next/server";
import { onSubmission } from "@/lib/platform/automation";
import { getClientIp } from "@/lib/rate-limit";
import { defaultPaymentProvider } from "@/lib/integrations/payments";
import { findRegistrationByCourseAndEmail, providerAmountOf } from "@/lib/lms/registrations";
import { getPaidRunContext, startCheckoutForSubmission } from "@/lib/lms/checkout";
import {
  ensurePublicSubmitInvitationColumn,
  ensurePublicSubmitInvitationIndex,
  ensurePublicSubmitRateTable,
  getActiveRunIdByPublicSlug,
  getActiveRunById,
  countRecentSubmissionsFromIp,
  getFormIdByRunId,
  getFormFieldsByFormId,
  getSubmittedSubmissionBySubmitter,
  insertRateEntryForSubmission,
  getDraftSubmissionBySubmitter,
  upgradeDraftToSubmitted,
  insertSubmittedSubmission,
  getFormSettingsByRunId,
  getFormById,
} from "@/models/publicFormRuns";

// platform_form_submissions.invitation_id self-heal stays: the column is
// written by the submission inserts below, so this route keeps it present —
// process, idempotent, never destructive.
let submitSchemaPromise = null;
async function ensurePublicSubmitSchema() {
  if (!submitSchemaPromise) {
    submitSchemaPromise = (async () => {
      try {
        await ensurePublicSubmitInvitationColumn();
        await ensurePublicSubmitInvitationIndex();
      } catch (error) {
        console.warn("[Public Submit] schema ensure failed:", error.message);
      }
      try {
        await ensurePublicSubmitRateTable();
      } catch (_) {}
      return true;
    })();
  }
  return submitSchemaPromise;
}

// The cookie that proves WHICH browser captured a registration. It carries a
// one-way token (only its hash is stored server-side) and is httpOnly, so no
// script and no stranger who merely knows the email can present it. It is what
// lets an unpaid payment be RESUMED by its own browser while everyone else is
// answered neutrally.
const CHECKOUT_COOKIE = "impactos_checkout";
const CHECKOUT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function readBrowserToken(req) {
  const fromCookies = req?.cookies?.get?.(CHECKOUT_COOKIE)?.value;
  if (fromCookies) return fromCookies;
  // Fallback for a plain Request (and for any runtime where `cookies` is absent).
  const header = req?.headers?.get?.("cookie") || "";
  const match = new RegExp(`(?:^|;\\s*)${CHECKOUT_COOKIE}=([^;]+)`).exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Attach the capture cookie — but only when a fresh registration minted one. */
function withBrowserCookie(response, browserToken) {
  if (!browserToken) return response;
  response.cookies.set({
    name: CHECKOUT_COOKIE,
    value: browserToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHECKOUT_COOKIE_MAX_AGE,
  });
  return response;
}

function courseSummary(course) {
  return { title: course.title, amount: course.amount, currency: course.currency };
}

function paymentConfig() {
  const provider = defaultPaymentProvider();
  return { ...provider.publicConfig(), configured: provider.isConfigured() };
}

/**
 * The answer for an EXISTING registration: it says only that one exists and
 * whether it is paid. No reference — the browser has no business holding one it
 * did not just create. This is the NEUTRAL reply; a payable retry is built from
 * `freshCheckoutPayload` instead.
 */
function neutralCheckoutPayload(paidContext, registration) {
  return {
    existing: Boolean(registration),
    paid: registration?.status === "paid",
    status: registration?.status || null,
    course: courseSummary(paidContext.course),
    consent_text: paidContext.course.consentText || null,
    payment: paymentConfig(),
  };
}

function freshCheckoutPayload(paidContext, registration) {
  return {
    existing: false,
    paid: false,
    reference: registration.reference,
    // What the payment window is asked for (the money's smallest unit when the
    // currency has one), and what the person is shown.
    amount: providerAmountOf(registration),
    display_amount: registration.amount,
    currency: registration.currency,
    consent_text: paidContext.course.consentText || null,
    email: registration.email,
    course: courseSummary(paidContext.course),
    payment: paymentConfig(),
  };
}

/**
 * Resolve the checkout for a paid Execution in ONE place.
 *
 * A FRESH (or a still-UNPAID one whose own browser is recognised by `browserToken`)
 * registration gets a payable payload with the reference: a person whose payment
 * failed must be able to pay again with the SAME record and the SAME reference.
 * A PAID one, and an unpaid one claimed by a stranger who knows only the email,
 * are answered NEUTRALLY — the reference is never handed back.
 */
async function preparePaidCheckout({ paidContext, submissionId, fullName, email, phone, language, browserToken }) {
  try {
    const started = await startCheckoutForSubmission({
      run: paidContext.run,
      course: paidContext.course,
      submissionId,
      fullName,
      email,
      phone,
      language: language || "fr",
      consent: true,
      browserToken,
    });
    if (started.registration) {
      return {
        checkout: freshCheckoutPayload(paidContext, started.registration),
        browserToken: started.browserToken || null,
      };
    }
    return {
      checkout: neutralCheckoutPayload(
        paidContext,
        await findRegistrationByCourseAndEmail(paidContext.course.id, email),
      ),
      browserToken: null,
    };
  } catch (error) {
    // The submission is already saved, so nothing is lost — but the payer must be
    // told the payment could not be prepared, not shown a blank end.
    console.warn("[Public Submit] checkout capture failed:", error.message);
    return { checkout: { failed: true, error: "lms.errors.checkoutUnavailable" }, browserToken: null };
  }
}

/**
 * POST /api/s/public-submit
 * Public endpoint — accepts form submissions without auth.
 * 
 * Security:
 * - Only active runs accepted
 * - Deadline enforced
 * - Max 100KB payload
 * - Duplicate detection by email
 * - IP-based rate limiting: max 5 submissions per IP per run per hour
 */
export async function POST(req) {
  let body = null;
  try {
    await initDb();
    await ensurePublicSubmitSchema();
    
    // Get client IP (trusted hop — see getClientIp; the per-run submission limit
    // below is only as good as the key it is counted under, RATE-2).
    const ip = getClientIp(req);
    
    // Rate limit: check content-length
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > 100000) {
      return NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 });
    }

    body = await req.json();
    const { data, slug, consent, language } = body;

    if (!slug || !data || typeof data !== "object") {
      return NextResponse.json({ success: false, error: "slug and data required" }, { status: 400 });
    }

    // Resolve the run from its public slug — numeric run IDs are never
    // accepted on the public endpoint (prevents sequential-ID probing).
    let run_id = null;
    try {
      const runBySlugResult = await getActiveRunIdByPublicSlug(slug);
      if (runBySlugResult.rows.length > 0) {
        run_id = runBySlugResult.rows[0].id;
      }
    } catch (error) {
      console.warn("[Public Submit] public_slug lookup failed:", error.message);
    }
    if (!run_id) {
      return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });
    }

    // Verify run exists and is active
    const runResult = await getActiveRunById(run_id);
    if (runResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });
    }

    // Check deadline
    if (runResult.rows[0].closes_at && new Date(runResult.rows[0].closes_at) < new Date()) {
      return NextResponse.json({ success: false, error: "Submission deadline has passed" }, { status: 400 });
    }

    // ── A PAID Execution resolves its course and its price SERVER-side, and
    // asks for consent, BEFORE anything is written. ──
    let paidContext = null;
    try {
      paidContext = await getPaidRunContext(run_id);
    } catch (error) {
      console.warn("[Public Submit] paid context read failed:", error.message);
    }
    if (paidContext?.hasCourse) {
      if (!paidContext.course) {
        return NextResponse.json({ success: false, error: "lms.errors.courseNotForSale" }, { status: 409 });
      }
      const accepted = consent === true || consent === "true";
      if (!accepted) {
        return NextResponse.json({ success: false, error: "lms.errors.registrationConsentRequired" }, { status: 400 });
      }
    }

    // Optional run invitation provenance is no longer resolved here: the
    // Venture intake flow has been retired.
    const invitationId = null;

    // IP-based rate limiting: max 5 submissions per IP per run per hour
    // Gracefully skip if rate table doesn't exist yet
    try {
      const rateCheckResult = await countRecentSubmissionsFromIp(run_id, ip);
      if (parseInt(rateCheckResult.rows[0]?.c) >= 5) {
        return NextResponse.json({ success: false, error: "Too many submissions. Please try again later." }, { status: 429 });
      }
    } catch (_) { /* table may not exist yet */ }

    // Find submitter identity by looking up form field labels
    let submitterName = "Anonymous";
    let submitterEmail = null;
    let submitterPhone = null;
    if (typeof data === "object" && run_id) {
      try {
        // Fetch form fields to map field IDs to labels
        const formIdResult = await getFormIdByRunId(run_id);
        if (formIdResult.rows.length > 0) {
          const fieldsResult = await getFormFieldsByFormId(formIdResult.rows[0].form_id);
          const fieldMap = {};
          for (const field of fieldsResult.rows) {
            fieldMap[String(field.id)] = { label: field.label, type: field.field_type };
          }
          // Now find name/email by field label, not field ID.
          // Name resolution: an explicit "Full Name" field wins; otherwise
          // fall back to the first "Name" field.
          let fullNameValue = "";
          let plainNameValue = "";
          for (const [key, value] of Object.entries(data)) {
            const fieldInfo = fieldMap[String(key)];
            if (!fieldInfo) continue;
            const label = (fieldInfo.label || "").toLowerCase();
            const fieldValue = typeof value === "string" && !value.startsWith("{") ? value.trim() : String(value).trim();
            if (!fieldValue) continue;
            const isFull = /full\s*name|fullname|nom\s+complet|pr[eé]nom\s*et\s*nom/.test(label);
            if (isFull && !fullNameValue) fullNameValue = fieldValue.substring(0, 200);
            else if (!isFull && (label.includes("name") || label.includes("nom")) && !plainNameValue) plainNameValue = fieldValue.substring(0, 200);
            if (label.includes("email") && !submitterEmail && fieldValue.includes("@")) {
              submitterEmail = fieldValue.substring(0, 200);
            }
            if (!submitterPhone && /phone|t[eé]l/.test(label)) {
              submitterPhone = fieldValue.substring(0, 40);
            }
          }
          if (fullNameValue || plainNameValue) submitterName = fullNameValue || plainNameValue;
        }
      } catch (_) {
        // Fallback: try matching by key (legacy approach), full name first
        let keyFullName = "";
        let keyPlainName = "";
        for (const [key, value] of Object.entries(data)) {
          const lowerKey = String(key).toLowerCase();
          const fieldValue = typeof value === "string" && !value.startsWith("{") ? value.trim() : String(value).trim();
          if (!fieldValue) continue;
          const isFull = /full\s*name|fullname|nom\s+complet/.test(lowerKey);
          if (isFull && !keyFullName) keyFullName = fieldValue.substring(0, 200);
          else if (!isFull && lowerKey.includes("name") && !keyPlainName) keyPlainName = fieldValue.substring(0, 200);
          if (lowerKey.includes("email") && !submitterEmail && fieldValue.includes("@")) submitterEmail = fieldValue.substring(0, 200);
          if (!submitterPhone && /phone|t[eé]l/.test(lowerKey)) submitterPhone = fieldValue.substring(0, 40);
        }
        if (submitterName === "Anonymous" && (keyFullName || keyPlainName)) submitterName = keyFullName || keyPlainName;
      }
    }
    const submitterId = submitterEmail || "public-" + Date.now();

    // A paid registration is anchored to a real address: it is where the receipt
    // and the way back are sent.
    if (paidContext?.hasCourse && !submitterEmail) {
      return NextResponse.json({ success: false, error: "lms.errors.registrationEmailRequired" }, { status: 400 });
    }

    // Prevent duplicate SUBMITTED entries by same email — idempotent:
    // a repeat submission returns success (not an error) so a participant who
    // resubmits after a misleading error is NOT told their application failed.
    if (submitterEmail) {
      const existing = await getSubmittedSubmissionBySubmitter(run_id, submitterEmail);
      if (existing.rows.length > 0) {
        // A paid Execution: a repeat submission is NOT simply "already done".
        // The SAME browser that captured the registration (its cookie) resumes
        // the SAME record and reference — a failed payment must not block the
        // person. Anyone else, and any PAID registration, is answered neutrally
        // (the reference is deliberately ABSENT) so the page offers the TWO exits.
        let prepared = { checkout: null, browserToken: null };
        if (paidContext?.hasCourse) {
          prepared = await preparePaidCheckout({
            paidContext,
            submissionId: existing.rows[0].id,
            fullName: submitterName,
            email: submitterEmail,
            phone: submitterPhone,
            language,
            browserToken: readBrowserToken(req),
          });
        }
        return withBrowserCookie(
          NextResponse.json({
            success: true,
            id: existing.rows[0].id,
            already_submitted: true,
            success_message: null,
            redirect_url: null,
            checkout: prepared.checkout,
          }),
          prepared.browserToken,
        );
      }
    }

    // Record rate limit entry (skip if table doesn't exist)
    try {
      await insertRateEntryForSubmission(run_id, ip);
    } catch (_) {}

    // Insert submission — or upgrade existing draft
    let submissionId;
    if (submitterEmail) {
      const draftResult = await getDraftSubmissionBySubmitter(run_id, submitterEmail);
      if (draftResult.rows.length > 0) {
        await upgradeDraftToSubmitted(data, submitterName, invitationId, draftResult.rows[0].id);
        submissionId = draftResult.rows[0].id;
      }
    }

    if (!submissionId) {
      const result = await insertSubmittedSubmission(run_id, submitterId, submitterName, data, invitationId);
      submissionId = result.rows[0].id;
    }

    // Fetch form settings for success message configuration
    let successConfig = null;
    try {
      const formSettingsResult = await getFormSettingsByRunId(run_id);
      if (formSettingsResult.rows.length > 0 && formSettingsResult.rows[0].settings) {
        const settings = formSettingsResult.rows[0].settings;
        const automationSettings = settings.automation || {};
        successConfig = {
          message: automationSettings.success_message || null,
          redirect_url: automationSettings.redirect_after_submit || null,
        };
      }
    } catch (_) {}

    // ── PAID EXECUTION: the SAME request captures the registration ──
    // One submission = one registration. Nothing about the money is trusted
    // from the browser: the price and the reference are decided here. A FRESH or
    // still-UNPAID registration is payable; a PAID one is answered neutrally —
    // its reference is never handed back, which is what made an account takeover
    // possible.
    let checkout = null;
    let mintedBrowserToken = null;
    if (paidContext?.hasCourse) {
      const prepared = await preparePaidCheckout({
        paidContext,
        submissionId,
        fullName: submitterName,
        email: submitterEmail,
        phone: submitterPhone,
        language,
        browserToken: readBrowserToken(req),
      });
      checkout = prepared.checkout;
      mintedBrowserToken = prepared.browserToken;
    }

    // Fire post-submission automation (CRM contact, confirmation email, owner
    // notification) in the background so it never blocks or breaks the response.
    // The submission is already saved — any automation failure is logged, not
    // surfaced to the participant.
    try {
      const runForAuto = runResult.rows[0];
      let formForAuto = null;
      const formResult = await getFormById(runForAuto?.form_id);
      formForAuto = formResult.rows[0] || null;
      after(() => {
        onSubmission(
          {
            id: submissionId,
            run_id: parseInt(run_id),
            submitter_id: submitterId,
            submitter_name: submitterName,
            status: "submitted",
            data,
            submitted_at: new Date(),
          },
          runForAuto || { id: parseInt(run_id) },
          formForAuto,
          null,
        );
      });
    } catch (_) {}

    return withBrowserCookie(
      NextResponse.json({
        success: true,
        id: submissionId,
        success_message: successConfig?.message || null,
        // A paid Execution must not be redirected away: the page has to open the
        // payment window next.
        redirect_url: paidContext?.hasCourse ? null : successConfig?.redirect_url || null,
        checkout,
      }),
      mintedBrowserToken,
    );
  } catch (error) {
    console.error("[Public Submit] Error:", error.message, error.stack);
    console.error("[Public Submit] Request body snippet:", JSON.stringify(body || {}).substring(0, 200));
    return NextResponse.json({ success: false, error: "An error occurred — our team has been notified" }, { status: 500 });
  }
}
