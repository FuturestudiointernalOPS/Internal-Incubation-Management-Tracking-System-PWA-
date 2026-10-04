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
const { POST: submitPOST } = require("@/app/api/s/public-submit/route");
const { GET: checkoutGET, POST: checkoutPOST } = require("@/app/api/public/checkout/route");
const { POST: webhookPOST } = require("@/app/api/webhooks/kkiapay/route");
const { createCheckoutFixtures } = require("./helpers/lmsCheckoutFixtures");

const {
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
} = createCheckoutFixtures({ mockFake, submitPOST, webhookPOST });

beforeEach(() => {
  reset();
  jest.clearAllMocks();
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
    // The password link points the person at their course, not a home screen.
    expect(served.url).toContain(`next=${encodeURIComponent("/participant/learning/crs-1")}`);

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

    const { issueResumeLink } = require("@/services/lms/checkout");
    const { getRegistrationByReference } = require("@/models/lms/registrations");
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

  test("a MISSED notification is still closed when the payer's own tab re-verifies", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });
    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    expect(mockFake.state.lms_registrations[0].status).toBe("pending");

    // No webhook ever arrived. The provider, asked again, says the money moved.
    global.fetch = jest.fn(async () => verifiedResponse(25000));

    const res = await checkoutPOST(
      new Request("http://localhost/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          reference: created.checkout.reference,
          email: "john@example.com",
          transactionId: "TX-FROM-BROWSER",
        }),
      }),
    );
    const data = await readJson(res);

    expect(data.success).toBe(true);
    expect(data.payment).toBe("paid");
    expect(mockFake.state.lms_registrations[0].status).toBe("paid");
    // The access is finished too, exactly as the notification path would.
    expect(mockFake.state.lms_registrations[0].access_status).toBe("granted");
  });

  test("the tab's re-verify grants NOTHING while the provider has not settled", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });
    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));

    global.fetch = jest.fn(async () => verifiedResponse(25000, "PENDING"));

    const data = await readJson(
      await checkoutPOST(
        new Request("http://localhost/api/public/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "verify",
            reference: created.checkout.reference,
            email: "john@example.com",
            transactionId: "TX-FROM-BROWSER",
          }),
        }),
      ),
    );

    expect(data.payment).toBe("pending");
    expect(mockFake.state.lms_registrations[0].status).toBe("pending");
  });

  test("the tab's re-verify refuses an email that does not match the registration", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });
    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    global.fetch = jest.fn(async () => verifiedResponse(25000));

    const res = await checkoutPOST(
      new Request("http://localhost/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          reference: created.checkout.reference,
          email: "someone-else@example.com",
          transactionId: "TX-FROM-BROWSER",
        }),
      }),
    );

    expect(res.status).toBe(404);
    expect(mockFake.state.lms_registrations[0].status).toBe("pending");
  });
});
