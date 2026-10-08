/**
 * CHECKOUT — the capture (one submission = one registration).
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, statements in
 * `@/models/lms/registrations`.
 */

import { v4 as uuidv4 } from "uuid";
import { hashToken } from "@/lib/token-hashing";
import { LmsError } from "@/models/lms/errors";
import {
  generateReference,
  createRegistration,
  toProviderAmount,
  findRegistrationByCourseAndEmail,
  updateRegistrationAttempt,
  resetRegistrationForRetry,
  setBrowserToken,
  matchesBrowserToken,
} from "@/models/lms/registrations";

/**
 * Capture the person for a paid Execution. Called SERVER-side, right after the
 * submission is stored, so the registration can never outrun the form run.
 *
 * An UNPAID registration that already exists is a RETRY — but only for the
 * browser that captured it, proven by the cookie token it received. That same
 * browser gets the SAME record and the SAME reference back (and the row returns
 * to 'pending'); a stranger who merely knows the email is answered NEUTRALLY, the
 * reference never handed back. A FAILED transaction must never block the person,
 * yet a leaked email must never hand someone else the way in.
 *
 * A PAID registration is answered NEUTRALLY too: there is nothing left to pay.
 *
 * Returns `browserToken` (the RAW one-way token) ONLY when a fresh registration
 * was captured, so the caller can place it in an httpOnly cookie.
 */
export async function startCheckoutForSubmission({
  run,
  course,
  submissionId,
  fullName,
  email,
  phone = null,
  language = "en",
  consent = false,
  browserToken = null,
}) {
  const existing = await findRegistrationByCourseAndEmail(course.id, email);
  if (existing) {
    if (existing.status === "paid") {
      return { ok: true, existing: true, paid: true, status: "paid", registration: null };
    }
    const owns = matchesBrowserToken(existing, browserToken ? hashToken(browserToken) : null);
    if (!owns) {
      return { ok: true, existing: true, paid: false, status: existing.status, registration: null };
    }
    await updateRegistrationAttempt(existing.id, {
      fullName,
      phone,
      language,
      runId: run.id,
      submissionId,
    });
    await resetRegistrationForRetry(existing.id);
    return {
      ok: true,
      existing: true,
      paid: false,
      status: "pending",
      registration: { ...existing, status: "pending" },
    };
  }

  if (!consent) throw new LmsError("lms.errors.registrationConsentRequired", 400);

  const registration = await createRegistration({
    reference: generateReference(),
    runId: run.id,
    submissionId,
    courseId: course.id,
    fullName,
    email,
    phone,
    language,
    amount: course.amount,
    currency: course.currency,
    providerAmount: toProviderAmount(course.amount, course.amountUnit),
    consent: true,
  });

  // The browser that captured the registration receives a one-way token in an
  // httpOnly cookie; only its HASH is stored. It is the proof that lets THIS
  // browser resume an unpaid payment directly.
  const rawBrowserToken = browserToken || uuidv4();
  await setBrowserToken(registration.id, { tokenHash: hashToken(rawBrowserToken) });

  return { ok: true, existing: false, paid: false, registration, browserToken: rawBrowserToken };
}