/**
 * LMS CHECKOUT — the decisions the team takes after the payment (Phase 5).
 *
 * Covers the refund and access path on a paid registration: the access status
 * that follows, and the journal line a revocation leaves for the team.
 *
 * The payment flow is in lms-checkout.postPayment.test.js and the amount unit in
 * lms-checkout.amountAndSettings.test.js. The seeds live in
 * ./helpers/lmsCheckoutFixtures.
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

describe("the team's refund and access decisions", () => {
  const { POST: registrationPOST } = require("@/app/api/lms/registrations/[id]/route");

  const act = (id, body) =>
    registrationPOST(
      new Request(`http://localhost/api/lms/registrations/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: { id } },
    );

  /** A registration whose payment was verified: access granted, receipt sent. */
  async function paidRegistration() {
    configureKkiapay();
    const courseId = seedCourse();
    seedRun({ courseId });
    const created = await readJson(await submitRequest({ slug: "run-slug", data: FORM_DATA, consent: true }));
    global.fetch = jest.fn(async () => verifiedResponse(25000));
    await webhookRequest(successNotification(created.checkout.reference), { "x-kkiapay-secret": WEBHOOK_SECRET });
    return mockFake.state.lms_registrations[0];
  }

  /** The provider's refund answers OK; nothing else is allowed to reach the network. */
  const refundSucceeds = () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
  };

  test("a refund KEEPS the access: refunding and revoking are two decisions", async () => {
    const registration = await paidRegistration();
    refundSucceeds();

    const data = await readJson(await act(registration.id, { action: "refund" }));

    expect(data.success).toBe(true);
    expect(data.access_revoked).toBe(false);
    expect(mockFake.state.lms_registrations[0].status).toBe("refunded");
    // The access is untouched, and so is the enrollment behind it.
    expect(mockFake.state.lms_registrations[0].access_status).toBe("granted");
    expect(mockFake.state.lms_enrollments[0].status).toBeUndefined();
  });

  test("a refund may remove the access in the same step", async () => {
    const registration = await paidRegistration();
    refundSucceeds();

    const data = await readJson(await act(registration.id, { action: "refund", revokeAccess: true }));

    expect(data.access_revoked).toBe(true);
    expect(mockFake.state.lms_registrations[0].access_status).toBe("revoked");
    // Suspended is the state the rest of the platform reads as "no access".
    expect(mockFake.state.lms_enrollments[0].status).toBe("suspended");
  });

  test("the access can be removed later — but only once the registration is refunded", async () => {
    const registration = await paidRegistration();

    // Still paid: refusing protects a paying customer's access.
    const tooEarly = await act(registration.id, { action: "revoke-access" });
    expect(tooEarly.status).toBe(409);
    expect(mockFake.state.lms_registrations[0].access_status).toBe("granted");

    refundSucceeds();
    await act(registration.id, { action: "refund" });

    const data = await readJson(await act(registration.id, { action: "revoke-access" }));

    expect(data.success).toBe(true);
    expect(data.access).toBe("revoked");
    expect(mockFake.state.lms_registrations[0].access_status).toBe("revoked");
    expect(mockFake.state.lms_enrollments[0].status).toBe("suspended");
    // The revocation leaves a journal line the team can see.
    expect(mockFake.state.lms_payment_events.some((event) => event.event_type === "access.revoked")).toBe(true);
  });
});
