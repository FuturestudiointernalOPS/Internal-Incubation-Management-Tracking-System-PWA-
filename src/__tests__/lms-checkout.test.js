/**
 * LMS CHECKOUT — paid form run → payment → course access
 *
 * The contract this suite pins, in the order the corrections were asked for:
 *
 *   - the price is decided SERVER-side and a browser-sent amount is ignored;
 *   - an EXISTING registration is answered NEUTRALLY — its reference is NEVER
 *     handed back (the account-takeover fix), and the two exits are offered;
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
 *     one-time code.
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

jest.mock("@/lib/authorization", () => ({
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

jest.mock("@/lib/platform/automation", () => ({ onSubmission: jest.fn() }));

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

const submitRequest = (body) =>
  submitPOST(
    new Request("http://localhost/api/s/public-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

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

  test("an EXISTING registration is answered NEUTRALLY — the reference is never handed back", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });

    const first = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    expect(first.checkout.reference).toBeDefined();

    const second = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));

    // Still ONE registration…
    expect(mockFake.state.lms_registrations.length).toBe(1);
    // …and the repeat learns only that it exists.
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

describe("the payer's own tab", () => {
  async function captureAndPay() {
    configureKkiapay();
    const reference = await capture();
    global.fetch = jest.fn(async () => verifiedResponse(25000));
    await webhookRequest(successNotification(reference), { "x-kkiapay-secret": WEBHOOK_SECRET });
    // The fake database has a FIXED clock, so the test states the moment it wants
    // to reason about: a payment that has just been confirmed.
    mockFake.state.lms_registrations[0].paid_at = new Date().toISOString();
    return reference;
  }

  async function capture() {
    const courseId = seedCourse();
    seedRun({ courseId });
    const data = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    return data.checkout.reference;
  }

  test("the state requires the payer's email and reports payment and access SEPARATELY", async () => {
    const reference = await captureAndPay();

    const wrong = await checkoutGET(
      new Request(`http://localhost/api/public/checkout?reference=${reference}&email=someone@else.io`),
    );
    expect(wrong.status).toBe(404);

    const right = await readJson(
      await checkoutGET(
        new Request(`http://localhost/api/public/checkout?reference=${reference}&email=john@example.com`),
      ),
    );
    expect(right.payment).toBe("paid");
    expect(right.access).toBe("granted");
    expect(right.email).toBe("sent");
    expect(right.accessWindowOpen).toBe(true);
    // The response never echoes the reference back.
    expect(right.reference).toBeUndefined();
  });

  test("inside the window the access link is served; outside it, it is not", async () => {
    const reference = await captureAndPay();

    const served = await readJson(
      await checkoutPOST(
        new Request("http://localhost/api/public/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "access", reference, email: "john@example.com" }),
        }),
      ),
    );
    expect(served.served).toBe(true);
    expect(served.url).toContain("/setup-password/");

    // Age the payment past the window.
    mockFake.state.lms_registrations[0].paid_at = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const late = await readJson(
      await checkoutPOST(
        new Request("http://localhost/api/public/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "access", reference, email: "john@example.com" }),
        }),
      ),
    );
    expect(late.served).toBe(false);
    expect(late.emailed).toBe(true);
  });

  test("the resend door is always neutral, and mints a fresh one-time link by email", async () => {
    await captureAndPay();
    sendStandaloneEmail.mockClear();

    const res = await checkoutPOST(
      new Request("http://localhost/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", email: "john@example.com" }),
      }),
    );
    const data = await readJson(res);

    expect(data.success).toBe(true);
    // Nothing about existence or references is disclosed.
    expect(data.reference).toBeUndefined();
    expect(sendStandaloneEmail).toHaveBeenCalledTimes(1);
    expect(mockFake.state.lms_registrations[0].email_status).toBe("sent");
  });

  test("an invalid resume token is refused", async () => {
    const res = await checkoutPOST(
      new Request("http://localhost/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "continue", token: "not-a-real-token" }),
      }),
    );
    expect(res.status).toBe(410);
  });

  test("a resume token hands the reference over ONLY to the link's holder", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });
    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));

    const { issueResumeLink } = require("@/lib/lms/checkout");
    const { getRegistrationByReference } = require("@/lib/lms/registrations");
    const registration = await getRegistrationByReference(created.checkout.reference);
    const token = await issueResumeLink(registration);

    const res = await checkoutPOST(
      new Request("http://localhost/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "continue", token }),
      }),
    );
    const data = await readJson(res);

    expect(data.success).toBe(true);
    expect(data.reference).toBe(created.checkout.reference);
  });

  test("the browser's transaction id is a HINT only — it cannot grant access", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });
    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));

    const res = await checkoutPOST(
      new Request("http://localhost/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "hint",
          reference: created.checkout.reference,
          transactionId: "TX-FROM-BROWSER",
        }),
      }),
    );
    const data = await readJson(res);

    expect(data.success).toBe(true);
    // Recorded as a trace…
    expect(mockFake.state.lms_registrations[0].provider_transaction_id).toBe("TX-FROM-BROWSER");
    // …and the payment is still NOT confirmed.
    expect(mockFake.state.lms_registrations[0].status).toBe("pending");
    expect(mockFake.state.lms_enrollments.length).toBe(0);
  });
});

describe("the amount unit is definable", () => {
  test("by default the price is sent whole, and compared whole", async () => {
    configureKkiapay();
    const courseId = seedCourse({ price: 25000 });
    seedRun({ courseId });

    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));

    expect(created.checkout.amount).toBe(25000);
    expect(created.checkout.display_amount).toBe(25000);
  });

  test("a minor-unit currency is scaled at both edges, and the person still reads the price", async () => {
    configureKkiapay();
    process.env.PAYMENT_AMOUNT_UNIT = "minor";
    process.env.PAYMENT_CURRENCY = "eur";

    const courseId = seedCourse({ price: 250 });
    seedRun({ courseId });

    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));

    // What the payment window is asked for, and what the person is shown.
    expect(created.checkout.amount).toBe(25000);
    expect(created.checkout.display_amount).toBe(250);
    expect(created.checkout.currency).toBe("EUR");

    // The verification reports in the provider's unit, so it must match the
    // SCALED price — otherwise everything would be refused in silence.
    global.fetch = jest.fn(async () => verifiedResponse(25000));
    const paid = await readJson(
      await webhookRequest(successNotification(created.checkout.reference, "TX-1", 25000), {
        "x-kkiapay-secret": WEBHOOK_SECRET,
      }),
    );
    expect(paid.payment).toBe("paid");
    expect(mockFake.state.lms_registrations[0].status).toBe("paid");
    // The stored price stays in whole units.
    expect(mockFake.state.lms_registrations[0].amount).toBe(250);
  });

  test("an explicit multiplier wins over the unit keyword", async () => {
    configureKkiapay();
    process.env.PAYMENT_AMOUNT_UNIT = "minor";
    process.env.PAYMENT_AMOUNT_MULTIPLIER = "1000";

    const courseId = seedCourse({ price: 7 });
    seedRun({ courseId });

    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    expect(created.checkout.amount).toBe(7000);
  });
});
