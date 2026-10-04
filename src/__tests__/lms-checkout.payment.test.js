/**
 * LMS CHECKOUT — paid form run → payment → course access
 *
 * The contract this suite pins, in the order the corrections were asked for:
 *
 *   - the price is decided SERVER-side and a browser-sent amount is ignored;
 *   - a repeat on an UNPAID registration RESUMES the same reference (a failed
 *     payment must never block the person); an EXISTING PAID registration is
 *     answered NEUTRALLY — its reference is NEVER handed back (the
 *     account-takeover fix), and the two exits are offered;
 *   - the notification carries NO status: it must not be the decider, and a
 *     `event`/`isPaymentSucces` payload must still be recognised;
 *   - the notification is verified server-side and the amount must match;
 *   - a duplicate does nothing; an unknown reference creates nothing;
 *   - the payment and the access are reported SEPARATELY, so a confirmed payment
 *     with a failed access is never shown as "still pending" and never invites a
 *     second payment;
 *   - the receipt goes out as soon as the payment is confirmed;
 *   - the access link is served only inside the short window, and the account is
 *     created pending (the password is chosen by the person) with a HASH-only
 *     one-time code;
 *   - a MISSED notification is not a dead end: the payer's own tab can ask the
 *     server to re-verify with the provider, and the SERVER still decides.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", role: "super_admin" })),
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/token-hashing", () => ({
  hashToken: (token) => `hash:${token}`,
  ensureTokenHashColumns: jest.fn(async () => true),
}));

jest.mock("@/lib/email", () => ({
  sendStandaloneEmail: jest.fn(async () => ({ success: true, provider: "gmail" })),
  sendEmail: jest.fn(async () => ({ success: true, provider: "gmail" })),
}));

jest.mock("@/models/platform/automation", () => ({ onSubmission: jest.fn() }));

const { sendStandaloneEmail } = require("@/lib/email");
const { GET: runGET } = require("@/app/api/s/public-run/route");
const { POST: submitPOST } = require("@/app/api/s/public-submit/route");
const { GET: checkoutGET, POST: checkoutPOST } = require("@/app/api/public/checkout/route");
const { POST: webhookPOST } = require("@/app/api/webhooks/kkiapay/route");

const readJson = (res) => res.json();

// The EXACT environment variable names the adapter reads (see kkiapay.js).
const ENV = {
  publicKey: "NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY",
  privateKey: "KKIAPAY_PRIVATE_KEY",
  secretKey: "KKIAPAY_SECRET_KEY",
  webhookSecret: "KKIAPAY_WEBHOOK_SECRET",
};

const WEBHOOK_SECRET = "webhook-secret";

function configureKkiapay() {
  process.env[ENV.publicKey] = "pub_test";
  process.env[ENV.privateKey] = "priv_test";
  process.env[ENV.secretKey] = "api_secret_test";
  process.env[ENV.webhookSecret] = WEBHOOK_SECRET;
}

function unconfigureKkiapay() {
  for (const name of Object.values(ENV)) delete process.env[name];
}

/** A published, public, PAID course. */
function seedCourse(overrides = {}) {
  const id = overrides.id || "crs-1";
  mockFake.seed("lms_courses", [
    {
      id,
      slug: overrides.slug || "venture-2026",
      title: overrides.title || "Advanced Venture Creation 2026",
      description: "A course.",
      thumbnail_url: null,
      status: overrides.status || "published",
      visibility: overrides.visibility || "public",
      is_free: overrides.is_free !== undefined ? overrides.is_free : false,
      price: overrides.price !== undefined ? overrides.price : 25000,
      payment_currency: overrides.payment_currency || null,
      payment_amount_unit: overrides.payment_amount_unit || null,
      payment_consent_text: overrides.payment_consent_text || null,
      created_by: "U-ADMIN",
    },
  ]);
  return id;
}

/** An Execution. `courseId` null = a normal, free form run. */
function seedRun({ id = 7, slug = "run-slug", courseId = null, status = "active", formId = 3 } = {}) {
  mockFake.seed("platform_form_runs", [
    {
      id,
      form_id: formId,
      name: "Registration",
      status,
      closes_at: null,
      public_slug: slug,
      lms_course_id: courseId,
    },
  ]);
  mockFake.seed("platform_forms", [{ id: formId, name: "Registration", settings: null }]);
  mockFake.seed("platform_form_sections", [{ id: 1, form_id: formId, title: "Identity", sort_order: 0 }]);
  // The submitter's identity is resolved from the FIELD LABELS, exactly as the
  // real public-submit route does it.
  mockFake.seed("platform_form_fields", [
    { id: "f-name", form_id: formId, label: "Full Name", field_type: "text", sort_order: 0 },
    { id: "f-email", form_id: formId, label: "Email address", field_type: "text", sort_order: 1 },
    { id: "f-phone", form_id: formId, label: "Phone number", field_type: "text", sort_order: 2 },
  ]);
  return id;
}

const FORM_DATA = { "f-name": "John Doe", "f-email": "john@example.com" };

const submitRequest = (body, cookie = null) =>
  submitPOST(
    new Request("http://localhost/api/s/public-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );

/** The capture cookie a submission response sets (if any), as a Cookie header. */
function captureCookie(res) {
  const header = res.headers.get("set-cookie") || "";
  const match = /impactos_checkout=([^;]+)/.exec(header);
  return match ? `impactos_checkout=${match[1]}` : null;
}

const webhookRequest = (body, headers = {}) =>
  webhookPOST(
    new Request("http://localhost/api/webhooks/kkiapay", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

/** A Kkiapay VERIFIED response, as the documented payload shapes it. */
function verifiedResponse(amount, status = "SUCCESS") {
  return {
    ok: true,
    json: async () => ({ status, amount, partnerId: "partner-1" }),
  };
}

/** A Kkiapay NOTIFICATION: no `status` field at all — only `event`. */
function successNotification(reference, transactionId = "TX-1", amount = 25000) {
  return {
    transactionId,
    isPaymentSucces: true,
    account: "22996000000",
    method: "MOBILE_MONEY",
    amount,
    fees: 19,
    partnerId: reference,
    event: "transaction.success",
  };
}

beforeEach(() => {
  mockFake.reset();
  jest.clearAllMocks();
  unconfigureKkiapay();
  delete process.env.PAYMENT_CURRENCY;
  delete process.env.PAYMENT_AMOUNT_UNIT;
  delete process.env.PAYMENT_AMOUNT_MULTIPLIER;
  global.fetch = undefined;
});


describe("a paid Execution", () => {
  test("exposes its course and its server-side price", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });

    const res = await runGET(new Request("http://localhost/api/s/public-run?slug=run-slug"));
    const data = await readJson(res);

    expect(data.success).toBe(true);
    expect(data.checkout.course.amount).toBe(25000);
    expect(data.checkout.payment.key).toBe("pub_test");
    expect(data.checkout.payment.configured).toBe(true);
  });

  test("a free Execution behaves exactly as before", async () => {
    const courseId = null;
    seedCourse();
    seedRun({ courseId });

    const res = await runGET(new Request("http://localhost/api/s/public-run?slug=run-slug"));
    const data = await readJson(res);

    expect(data.success).toBe(true);
    expect(data.checkout).toBeNull();
  });
});

describe("capturing the person", () => {
  test("the submission is stored AND the registration created, with the SERVER amount", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });

    const res = await submitRequest({
      slug: "run-slug",
      data: { ...FORM_DATA, "f-amount": "1" }, // a tampered amount must be ignored
      consent: true,
      language: "fr",
    });
    const data = await readJson(res);

    expect(data.success).toBe(true);
    // The submission IS the Execution's visible trace.
    expect(mockFake.state.platform_form_submissions.length).toBe(1);
    expect(mockFake.state.lms_registrations.length).toBe(1);

    const registration = mockFake.state.lms_registrations[0];
    expect(registration.amount).toBe(25000);
    expect(registration.reference).toMatch(/^REG-\d{4}-[0-9A-F]{8}$/);
    expect(registration.status).toBe("pending");
    expect(registration.language).toBe("fr");
    expect(registration.run_id).toBe(7);

    // The FRESH registration is the only case that gets a reference.
    expect(data.checkout.reference).toBe(registration.reference);
    expect(data.checkout.email).toBe("john@example.com");
  });

  test("a paid capture without consent is refused, and nothing is written", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });

    const res = await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: false });
    expect(res.status).toBe(400);
    expect(mockFake.state.platform_form_submissions.length).toBe(0);
    expect(mockFake.state.lms_registrations.length).toBe(0);
  });

  test("a repeat on an UNPAID registration RESUMES the same reference for its OWN browser", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });

    const firstResponse = await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true });
    const cookie = captureCookie(firstResponse);
    expect(cookie).toBeTruthy();
    const first = await readJson(firstResponse);
    expect(first.checkout.reference).toBeDefined();

    const second = await readJson(
      await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }, cookie),
    );

    // Still ONE registration…
    expect(mockFake.state.lms_registrations.length).toBe(1);
    // …and the retry pays with the SAME record and the SAME reference.
    expect(second.checkout.reference).toBe(first.checkout.reference);
    expect(second.checkout.email).toBe("john@example.com");
    expect(second.checkout.amount).toBe(25000);
  });

  test("a stranger who knows only the email is answered NEUTRALLY — no reference", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });

    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    expect(created.checkout.reference).toBeDefined();

    // A different browser: no capture cookie, same email.
    const stranger = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));

    expect(mockFake.state.lms_registrations.length).toBe(1);
    expect(stranger.checkout.existing).toBe(true);
    expect(stranger.checkout.reference).toBeUndefined();
    expect(JSON.stringify(stranger)).not.toContain(created.checkout.reference);
  });

  test("a repeat on a PAID registration is answered NEUTRALLY even for its own browser", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });

    const firstResponse = await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true });
    const cookie = captureCookie(firstResponse);
    const first = await readJson(firstResponse);
    global.fetch = jest.fn(async () => verifiedResponse(25000));
    await webhookRequest(successNotification(first.checkout.reference), { "x-kkiapay-secret": WEBHOOK_SECRET });
    expect(mockFake.state.lms_registrations[0].status).toBe("paid");

    const second = await readJson(
      await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }, cookie),
    );

    // Still ONE registration…
    expect(mockFake.state.lms_registrations.length).toBe(1);
    // …and the repeat learns only that it exists — never the reference.
    expect(second.checkout.existing).toBe(true);
    expect(second.checkout.reference).toBeUndefined();
    expect(JSON.stringify(second)).not.toContain(first.checkout.reference);
  });

  test("a free Execution is unchanged: no registration, no reference", async () => {
    seedCourse();
    seedRun({ courseId: null });

    const data = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA }));

    expect(data.success).toBe(true);
    expect(data.checkout).toBeNull();
    expect(mockFake.state.lms_registrations.length).toBe(0);
  });
});

describe("the payment notification", () => {
  async function capture() {
    const courseId = seedCourse();
    seedRun({ courseId });
    const data = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    return data.checkout.reference;
  }

  test("an unsigned callback is refused", async () => {
    configureKkiapay();
    await capture();

    const res = await webhookRequest(successNotification("REG-2026-DEADBEEF"));

    expect(res.status).toBe(401);
    expect(mockFake.state.lms_registrations[0].status).toBe("pending");
  });

  test("an unknown reference is journaled and creates NOTHING", async () => {
    configureKkiapay();

    const res = await webhookRequest(successNotification("REG-2026-DEADBEEF"), {
      "x-kkiapay-secret": WEBHOOK_SECRET,
    });
    const data = await readJson(res);

    expect(data.success).toBe(true);
    expect(mockFake.state.lms_registrations.length).toBe(0);
    expect(mockFake.state.lms_payment_events.length).toBe(1);
    expect(mockFake.state.lms_payment_events[0].status).toBe("ignored");
    expect(mockFake.state.lms_payment_events[0].message).toBe("unknown_reference");
  });

  test("a notification WITHOUT a status field is recognised and settles the payment", async () => {
    configureKkiapay();
    const reference = await capture();
    global.fetch = jest.fn(async () => verifiedResponse(25000));

    const res = await webhookRequest(successNotification(reference), { "x-kkiapay-secret": WEBHOOK_SECRET });
    const data = await readJson(res);

    expect(data.payment).toBe("paid");
    expect(data.access).toBe("granted");

    const registration = mockFake.state.lms_registrations[0];
    expect(registration.status).toBe("paid");
    expect(registration.access_status).toBe("granted");
    expect(registration.provider_transaction_id).toBe("TX-1");

    // Identity + enrollment + a HASH-only one-time code; the password is never ours.
    expect(mockFake.state.contacts.length).toBe(1);
    expect(mockFake.state.contacts[0].role).toBe("participant");
    expect(mockFake.state.contacts[0].status).toBe("pending");
    expect(mockFake.state.contacts[0].password).toBeUndefined();
    expect(mockFake.state.lms_enrollments.length).toBe(1);
    expect(mockFake.state.lms_enrollments[0].source).toBe("purchase");

    const tokens = mockFake.state.password_setup_tokens;
    expect(tokens.length).toBe(1);
    expect(tokens[0].token_hash).toBeTruthy();
    // No usable code at rest.
    expect(tokens[0].token).toBeUndefined();

    // The receipt goes out with the payment, and carries a LINK, never a credential.
    expect(sendStandaloneEmail).toHaveBeenCalledTimes(1);
    const mail = sendStandaloneEmail.mock.calls[0][0];
    expect(mail.html).toContain("/setup-password/");
    // The one-time link carries WHERE to land, so the payer reaches the course.
    expect(mail.html).toContain(`next=${encodeURIComponent("/participant/learning/crs-1")}`);
    expect(mail.html).not.toContain("password:");
  });

  test("an unexpected payload shape is repaired by the verification", async () => {
    configureKkiapay();
    const reference = await capture();
    global.fetch = jest.fn(async () => verifiedResponse(25000));

    // No `event`, no `isPaymentSucces` — only the reference. The verified answer decides.
    const res = await webhookRequest(
      { transactionId: "TX-9", partnerId: reference, amount: 25000 },
      { "x-kkiapay-secret": WEBHOOK_SECRET },
    );
    const data = await readJson(res);

    expect(data.payment).toBe("paid");
    expect(mockFake.state.lms_registrations[0].status).toBe("paid");
  });

  test("an explicit failure is recorded as failed and grants nothing", async () => {
    configureKkiapay();
    const reference = await capture();

    const res = await webhookRequest(
      { ...successNotification(reference), isPaymentSucces: false, event: "transaction.failed" },
      { "x-kkiapay-secret": WEBHOOK_SECRET },
    );
    const data = await readJson(res);

    expect(data.payment).toBe("failed");
    expect(mockFake.state.lms_registrations[0].status).toBe("failed");
    expect(mockFake.state.lms_enrollments.length).toBe(0);
    expect(sendStandaloneEmail).not.toHaveBeenCalled();
  });

  test("a FAILED payment leaves its own browser able to pay again — same record, same reference", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });
    const firstResponse = await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true });
    const cookie = captureCookie(firstResponse);
    const first = await readJson(firstResponse);

    await webhookRequest(
      { ...successNotification(first.checkout.reference), isPaymentSucces: false, event: "transaction.failed" },
      { "x-kkiapay-secret": WEBHOOK_SECRET },
    );
    expect(mockFake.state.lms_registrations[0].status).toBe("failed");

    // The SAME browser comes back with the SAME email: it is NOT blocked. The
    // failure is cleared so the payer's own tab keeps waiting, and the retry
    // pays with the SAME record and the SAME reference.
    const retry = await readJson(
      await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }, cookie),
    );

    expect(mockFake.state.lms_registrations.length).toBe(1);
    expect(retry.checkout.reference).toBe(first.checkout.reference);
    expect(mockFake.state.lms_registrations[0].status).toBe("pending");
  });

  test("a falsified amount is refused, journaled, and grants nothing", async () => {
    configureKkiapay();
    const reference = await capture();
    global.fetch = jest.fn(async () => verifiedResponse(1));

    const res = await webhookRequest(successNotification(reference, "TX-1", 1), {
      "x-kkiapay-secret": WEBHOOK_SECRET,
    });

    expect(res.status).toBe(200);
    expect(mockFake.state.lms_registrations[0].status).toBe("pending");
    expect(mockFake.state.lms_enrollments.length).toBe(0);
    expect(sendStandaloneEmail).not.toHaveBeenCalled();
    expect(mockFake.state.lms_payment_events[0].message).toBe("amount_mismatch");
  });

  test("a duplicate does nothing — no second enrollment, no second receipt", async () => {
    configureKkiapay();
    const reference = await capture();
    global.fetch = jest.fn(async () => verifiedResponse(25000));
    const payload = successNotification(reference);
    const headers = { "x-kkiapay-secret": WEBHOOK_SECRET };

    await webhookRequest(payload, headers);
    sendStandaloneEmail.mockClear();
    const data = await readJson(await webhookRequest(payload, headers));

    expect(data.duplicate).toBe(true);
    expect(mockFake.state.lms_enrollments.length).toBe(1);
    expect(mockFake.state.password_setup_tokens.length).toBe(1);
    expect(sendStandaloneEmail).not.toHaveBeenCalled();
  });

  test("the receipt still goes out when the access step fails", async () => {
    configureKkiapay();
    const reference = await capture();
    global.fetch = jest.fn(async () => verifiedResponse(25000));

    // Force the access step to fail: an already-suspended enrollment is refused
    // by the enrollment insert, which is the case a replay must repair.
    mockFake.seed("lms_enrollments", [
      { id: "enr-1", course_id: "crs-1", user_cid: "USR-X", source: "admin", status: "suspended" },
    ]);

    const res = await webhookRequest(successNotification(reference), { "x-kkiapay-secret": WEBHOOK_SECRET });
    const data = await readJson(res);

    // The MONEY is confirmed and the receipt is sent regardless of the access.
    expect(data.payment).toBe("paid");
    expect(mockFake.state.lms_registrations[0].status).toBe("paid");
    expect(sendStandaloneEmail).toHaveBeenCalledTimes(1);
  });
});

