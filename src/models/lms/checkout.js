import db from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { LmsError } from "./errors";
import { LMS_CHECKOUT_ACCESS_WINDOW_MINUTES } from "./constants";
import {
  paymentCurrency,
  normalizeRegistrationEmail,
  generateReference,
  createRegistration,
  ensureCheckoutSchema,
  toProviderAmount,
  findRegistrationByCourseAndEmail,
  updateRegistrationAttempt,
  getRegistrationById,
  getRegistrationByReference,
  getRegistrationByTransactionId,
  getRegistrationByResumeTokenHash,
  listRegistrationsByEmail,
  setResumeToken,
  setAccessState,
  setEmailState,
  markRegistrationPaid,
  recordPaymentEvent,
} from "./registrations";

/**
 * CHECKOUT EXECUTION — everything that happens around the money for a paid
 * Execution: resolve the price SERVER-side, capture the registration, grant the
 * course access, and hand back a link only inside a short window.
 *
 * Reuses the existing identity (`contacts.cid`), the existing enrollment table
 * (`lms_enrollments`, source 'purchase') and the existing one-time password flow
 * (`password_setup_tokens`). No parallel users table, no parallel enrollment.
 */

// ─── The run <-> course link ────────────────────────────────────────────────
// The column (and the two tables) are created by the migration; the runtime
// self-heal keeps a fresh environment working the first time it is needed.

/**
 * The course a run sells, with the price read from the COURSE — never from the
 * form, never from the browser. Returns null when the course is not a sellable,
 * published, public, paid course.
 */
export async function resolveCheckoutCourse(courseId) {
  if (!courseId) return null;
  await ensureCheckoutSchema();
  const res = await db.execute({
    sql: `SELECT id, slug, title, description, thumbnail_url, status, visibility, is_free, price,
                 payment_currency, payment_amount_unit, payment_consent_text
          FROM lms_courses WHERE id = ?`,
    args: [courseId],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (row.status !== "published" || row.visibility !== "public") return null;
  if (row.is_free !== false) return null;

  const amount = Number(row.price);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    amount,
    // Per-course overrides, falling back to the environment.
    currency: String(row.payment_currency || paymentCurrency()).toUpperCase(),
    amountUnit: row.payment_amount_unit || null,
    consentText: row.payment_consent_text || null,
  };
}

/**
 * The paid context of a run.
 *
 *   { run, hasCourse: false }             -> a normal, free Execution (unchanged)
 *   { run, hasCourse: true, course }      -> a paid Execution, ready to sell
 *   { run, hasCourse: true, course:null } -> linked to a course that is not
 *                                            sellable: the caller MUST refuse
 *                                            rather than capture a free entry.
 */
export async function getPaidRunContext(runId) {
  if (!runId) return null;
  await ensureCheckoutSchema();
  const res = await db.execute({
    sql: "SELECT id, lms_course_id, public_slug, form_id, status FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
  const run = res.rows[0];
  if (!run) return null;
  if (!run.lms_course_id) return { run, hasCourse: false, course: null };
  return { run, hasCourse: true, course: await resolveCheckoutCourse(run.lms_course_id) };
}

/**
 * Attach a course to an Execution (or detach it with courseId null), so the
 * Execution becomes a paid checkout. The course must be sellable — published,
 * public and paid — otherwise nothing is attached.
 */
export async function linkRunToCourse({ runId, courseId = null }) {
  if (!runId) throw new LmsError("lms.errors.invalidPayload", 400);
  await ensureCheckoutSchema();

  if (courseId) {
    const course = await resolveCheckoutCourse(courseId);
    if (!course) throw new LmsError("lms.errors.courseNotForSale", 409);
  }

  await db.execute({
    sql: "UPDATE platform_form_runs SET lms_course_id = ?, updated_at = NOW() WHERE id = ?",
    args: [courseId || null, runId],
  });

  return { runId, courseId: courseId || null };
}

// ─── Identity + access ──────────────────────────────────────────────────────

export async function findContactForPurchase(email) {
  const res = await db.execute({
    sql: "SELECT cid, name, email, status, password, language FROM contacts WHERE email = ? AND deleted = 0",
    args: [normalizeRegistrationEmail(email)],
  });
  return res.rows[0] || null;
}

export async function insertPurchaseContact({ cid, name, email, phone, language = "en" }) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, role, status, group_name, language, created_at)
          VALUES (?, ?, ?, ?, 'participant', 'pending', 'LMS', ?, NOW())`,
    args: [cid, name, email, phone || null, language || "en"],
  });
}

export async function insertPurchaseEnrollment(courseId, userCid) {
  return db.execute({
    sql: `INSERT INTO lms_enrollments (course_id, user_cid, source)
          VALUES (?, ?, 'purchase')
          ON CONFLICT (course_id, user_cid) DO NOTHING`,
    args: [courseId, userCid],
  });
}

/**
 * A one-time link where the person chooses their OWN password. Only the HASH is
 * stored: a database leak yields no usable takeover link. The previous unused
 * token is invalidated, so only the newest link works.
 */
export async function issueAccessToken(contactCid) {
  try {
    await ensureTokenHashColumns();
  } catch (_) {
    // Self-healing is best-effort; a failure must not block the enrollment.
  }
  await db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
    args: [contactCid],
  }).catch(() => {});

  const token = uuidv4();
  await db.execute({
    sql: `INSERT INTO password_setup_tokens (token_hash, contact_cid, expires_at, token_type)
          VALUES (?, ?, NOW() + INTERVAL '48 hours', 'lms_purchase')`,
    args: [hashToken(token), contactCid],
  });
  return token;
}

export function accessWindowMinutes() {
  const configured = Number(process.env.CHECKOUT_ACCESS_WINDOW_MINUTES);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return LMS_CHECKOUT_ACCESS_WINDOW_MINUTES;
}

/**
 * The payer's own tab may be handed a link only while the moment is fresh.
 * Past the window the answer is "check your email", so a reference that leaked
 * elsewhere is worthless.
 */
export function accessWindowOpen(registration) {
  if (!registration?.paid_at || registration.status !== "paid") return false;
  const paidAt = new Date(registration.paid_at).getTime();
  if (!Number.isFinite(paidAt)) return false;
  return Date.now() - paidAt <= accessWindowMinutes() * 60 * 1000;
}

function loginUrl(courseId) {
  return `/login?next=${encodeURIComponent(`/participant/learning/${courseId}`)}`;
}

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
      url: `/setup-password/${fulfillment.accessToken}`,
    };
  }

  const token = await issueAccessToken(cid);
  return { ok: true, served: true, url: `/setup-password/${token}` };
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

// ─── Capture (one submission = one registration) ─────────────────────────────

/**
 * Capture the person for a paid Execution. Called SERVER-side, right after the
 * submission is stored, so the registration can never outrun the form run.
 *
 * When an existing registration is found, the answer is NEUTRAL: the caller
 * learns only that one exists (and whether it is paid). The reference is NEVER
 * handed back — that is what made the account takeover possible.
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
}) {
  const existing = await findRegistrationByCourseAndEmail(course.id, email);
  if (existing) {
    await updateRegistrationAttempt(existing.id, {
      fullName,
      phone,
      language,
      runId: run.id,
      submissionId,
    });
    return {
      ok: true,
      existing: true,
      paid: existing.status === "paid",
      status: existing.status,
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

  return { ok: true, existing: false, paid: false, registration };
}

// ─── The way back for an EXISTING registration ───────────────────────────────

/**
 * Resolve the payment context from a resume token. The token is NOT consumed on
 * read, so reloading the page still works; it merely expires (48h) or is
 * replaced when a newer link is issued. It never grants access on its own — only
 * the verified payment does.
 */
export async function resolveResumeToken(token) {
  const value = String(token || "").trim();
  if (!value) return null;
  const registration = await getRegistrationByResumeTokenHash(hashToken(value));
  if (!registration) return null;
  const expiresAt = new Date(registration.resume_token_expires_at || 0).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return registration;
}

const RESUME_TOKEN_TTL_HOURS = 48;

/**
 * Mint the "come back and finish" link for the person who owns this email. Only
 * the HASH is stored; the raw link is returned once, to be emailed.
 */
export async function issueResumeLink(registration) {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + RESUME_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await setResumeToken(registration.id, { tokenHash: hashToken(token), expiresAt });
  return token;
}

/**
 * Which registration an email refers to, for the fallback door. Paid wins (the
 * person wants in); otherwise the most recent unpaid attempt (they want to pay).
 */
export async function findResumableRegistration({ email, courseId = null }) {
  const cleanEmail = normalizeRegistrationEmail(email);
  if (!cleanEmail) return null;

  if (courseId) {
    const byCourse = await findRegistrationByCourseAndEmail(courseId, cleanEmail);
    if (byCourse) return byCourse;
  }
  const all = await listRegistrationsByEmail(cleanEmail);
  return all.find((row) => row.status === "paid") || all[0] || null;
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

/** Resolve a claimed-but-unverified success back to its registration. */
export async function findRegistrationForReconcile({ reference, transactionId }) {
  return (
    (reference ? await getRegistrationByReference(reference) : null) ||
    (transactionId ? await getRegistrationByTransactionId(transactionId) : null)
  );
}

export { recordPaymentEvent, markRegistrationPaid, setEmailState, setAccessState };
