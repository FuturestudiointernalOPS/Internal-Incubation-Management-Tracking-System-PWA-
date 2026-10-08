/**
 * LMS CHECKOUT — how the amount reaches the provider (Phase 5).
 *
 * The contract this suite pins:
 *   - the amount unit is definable (whole by default, and compared whole), so a
 *     price is never misread as a smaller unit;
 *   - a course carries its own currency, unit and consent wording.
 *
 * The paid form run → payment → course access flow is in
 * lms-checkout.postPayment.test.js, and the refund/access decisions the team
 * takes afterwards are in lms-checkout.teamDecisions.test.js. The seeds and the
 * request builders live in ./helpers/lmsCheckoutFixtures.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", role: "super_admin" })),
}));
jest.mock("@/server/auth/guards", () => ({
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

const { GET: runGET } = require("@/app/api/s/public-run/route");
const { POST: submitPOST } = require("@/app/api/s/public-submit/route");
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

describe("per-course payment settings", () => {
  test("a course carries its own currency, unit and consent wording", async () => {
    configureKkiapay();
    const courseId = seedCourse({
      price: 250,
      payment_currency: "GHS",
      payment_amount_unit: "minor",
      payment_consent_text: "Consentement propre au cours.",
    });
    seedRun({ courseId });

    const run = await readJson(await runGET(new Request("http://localhost/api/s/public-run?slug=run-slug")));
    expect(run.checkout.course.currency).toBe("GHS");
    expect(run.checkout.consent_text).toBe("Consentement propre au cours.");

    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    expect(created.checkout.amount).toBe(25000);
    expect(created.checkout.display_amount).toBe(250);
    expect(created.checkout.currency).toBe("GHS");
    expect(created.checkout.consent_text).toBe("Consentement propre au cours.");

    global.fetch = jest.fn(async () => verifiedResponse(25000));
    const paid = await readJson(
      await webhookRequest(successNotification(created.checkout.reference, "TX-9", 25000), {
        "x-kkiapay-secret": WEBHOOK_SECRET,
      }),
    );

    expect(paid.payment).toBe("paid");
    // What the provider was asked for is remembered, so a later change of the
    // course's unit can never invalidate an already-verified payment.
    expect(mockFake.state.lms_registrations[0].provider_amount).toBe(25000);
    expect(mockFake.state.lms_registrations[0].currency).toBe("GHS");
  });

  test("the registration is keyed to its submission and its Execution (what the Executions column reads)", async () => {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });
    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));

    const submissionId = mockFake.state.platform_form_submissions[0].id;
    const { listRegistrations } = require("@/models/lms/registrations");
    const rows = await listRegistrations({ runId: 7 });

    expect(rows.length).toBe(1);
    // These two keys are what the Executions screen maps a response to its payment.
    expect(String(rows[0].submission_id)).toBe(String(submissionId));
    expect(rows[0].run_id).toBe(7);
    expect(rows[0].reference).toBe(created.checkout.reference);
  });
});
