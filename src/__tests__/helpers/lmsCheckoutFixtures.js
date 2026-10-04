/**
 * Checkout fixtures for the LMS payment suites, bound to one fake database.
 *
 * A factory rather than a module of constants: the fake DB is created per test
 * file, so the seeds have to write into THAT instance, and the request builders
 * need the route handlers that suite registered. Callers do
 * `createCheckoutFixtures({ mockFake, submitPOST, webhookPOST })`.
 *
 * `reset()` is the whole beforeEach: the fake DB, the Kkiapay env vars, the
 * three PAYMENT_* vars the adapter reads, and the global fetch stub.
 */

function createCheckoutFixtures({ mockFake, submitPOST, webhookPOST }) {
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

  /** The whole beforeEach: fake DB, Kkiapay env, PAYMENT_* vars, global fetch. */
  function reset() {
    mockFake.reset();
    unconfigureKkiapay();
    delete process.env.PAYMENT_CURRENCY;
    delete process.env.PAYMENT_AMOUNT_UNIT;
    delete process.env.PAYMENT_AMOUNT_MULTIPLIER;
    global.fetch = undefined;
  }

  return {
    readJson,
    WEBHOOK_SECRET,
    configureKkiapay,
    seedCourse,
    seedRun,
    FORM_DATA,
    submitRequest,
    webhookRequest,
    verifiedResponse,
    successNotification,
    reset,
  };
};

module.exports = { createCheckoutFixtures };
