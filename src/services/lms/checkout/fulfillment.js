/**
 * CHECKOUT — access fulfilment: the money becomes a course, a person gets in.
 *
 * `fulfillRegistration` grants the access (idempotently, and never fatally: a
 * technical failure is recorded on the registration so the step stays
 * replayable); the three readers around it answer for the payer's own tab and
 * for the "prepare the right ONE-TIME link" case.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, statements in
 * `@/models/lms/checkoutStore` and `@/models/lms/registrations`.
 */

import { v4 as uuidv4 } from "uuid";
import { LmsError } from "@/models/lms/errors";
import {
  normalizeRegistrationEmail,
  getRegistrationById,
  getRegistrationByReference,
  setAccessState,
} from "@/models/lms/registrations";
import {
  findContactForPurchase,
  insertPurchaseContact,
  insertPurchaseEnrollment,
} from "./identity";
import { issueAccessToken, accessWindowOpen, accessWindowMinutes, loginUrl, setupPasswordUrl } from "./accessToken";

/**
 * Grant the course access for a PAID registration. Never throws on a technical
 * failure: the failure is recorded on the registration (the payment stays
 * intact, the incident is visible, and the step is replayable). Idempotent.
 */
export async function fulfillRegistration(registrationId) {
  const registration = await getRegistrationById(registrationId);
  if (!registration) throw new LmsError("lms.errors.registrationNotFound", 404);
  if (registration.status !== "paid") throw new LmsError("lms.errors.registrationNotPaid", 409);

  try {
    let contact = await findContactForPurchase(registration.email);
    let createdAccount = false;

    if (!contact) {
      const cid = `USR-${uuidv4().split("-")[0].toUpperCase()}`;
      await insertPurchaseContact({
        cid,
        name: registration.full_name,
        email: registration.email,
        phone: registration.phone,
        language: registration.language,
      });
      contact = { cid, password: null, language: registration.language };
      createdAccount = true;
    }

    await insertPurchaseEnrollment(registration.course_id, contact.cid);

    let accessToken = null;
    if (createdAccount || !contact.password) {
      accessToken = await issueAccessToken(contact.cid);
    }

    await setAccessState(registration.id, {
      status: "granted",
      error: null,
      userCid: contact.cid,
    });

    return {
      ok: true,
      userCid: contact.cid,
      courseId: registration.course_id ? String(registration.course_id) : null,
      accessToken,
      needsPasswordSetup: Boolean(accessToken),
      language: contact.language || registration.language || "en",
    };
  } catch (error) {
    await setAccessState(registration.id, {
      status: "failed",
      error: String(error?.message || error).substring(0, 500),
    }).catch(() => {});
    return { ok: false, error: "lms.errors.accessFailed" };
  }
}

/**
 * Where the payer's own browser goes right after paying: choose a password with
 * a fresh one-time link, or straight into My Learning when the account already
 * has one. Only valid inside the window.
 */
export async function mintAccessLinkForPayer({ reference, email }) {
  const registration = await getRegistrationByReference(reference);
  if (
    !registration ||
    normalizeRegistrationEmail(registration.email) !== normalizeRegistrationEmail(email)
  ) {
    return { ok: false, error: "lms.errors.registrationNotFound" };
  }
  if (registration.status !== "paid") {
    return { ok: false, error: "lms.errors.registrationNotPaid" };
  }
  if (!accessWindowOpen(registration)) {
    // The fluid moment has passed; the email is the door.
    return { ok: true, served: false, emailed: true };
  }

  const contact = await findContactForPurchase(registration.email);
  if (contact?.password) {
    return { ok: true, served: true, url: loginUrl(registration.course_id) };
  }

  const cid = registration.user_cid || contact?.cid;
  if (!cid) {
    // Paid but the access step never completed — run it now, then hand over.
    const fulfillment = await fulfillRegistration(registration.id);
    if (!fulfillment.ok) return { ok: false, error: fulfillment.error };
    return {
      ok: true,
      served: true,
      url: setupPasswordUrl(fulfillment.accessToken, registration.course_id),
    };
  }

  const token = await issueAccessToken(cid);
  return { ok: true, served: true, url: setupPasswordUrl(token, registration.course_id) };
}

/**
 * The payer's own tab: the two states that must stay DISTINCT, plus whether the
 * short window is still open. Never the reference, never a link.
 */
export async function getCheckoutStateForPayer({ reference, email }) {
  const registration = await getRegistrationByReference(reference);
  if (
    !registration ||
    normalizeRegistrationEmail(registration.email) !== normalizeRegistrationEmail(email)
  ) {
    return null;
  }
  return {
    payment: registration.status,
    access: registration.access_status,
    email: registration.email_status,
    accessWindowOpen: accessWindowOpen(registration),
    accessWindowMinutes: accessWindowMinutes(),
  };
}

/**
 * Prepare the right ONE-TIME link for an already-paid registration, without
 * sending anything: the caller decides and records the outcome.
 */
export async function prepareAccessDelivery(registration) {
  if (!registration || registration.status !== "paid") return { accessToken: null };

  const contact = await findContactForPurchase(registration.email);
  // An account that already has a password just signs in.
  if (contact?.password) return { accessToken: null };

  const cid = registration.user_cid || contact?.cid;
  if (!cid) {
    const fulfillment = await fulfillRegistration(registration.id);
    return { accessToken: fulfillment.ok ? fulfillment.accessToken : null };
  }
  return { accessToken: await issueAccessToken(cid) };
}