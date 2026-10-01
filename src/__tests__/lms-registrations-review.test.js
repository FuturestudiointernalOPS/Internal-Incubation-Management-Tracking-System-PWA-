/**
 * Characterisation tests for the LMS registration team actions
 * (POST /api/lms/registrations/[id]).
 *
 * The integration suite `lms-checkout.test.js` drives refund/revoke through a
 * fake database; this suite pins the branches it does not reach — the not-found
 * and invalid-action answers, the not-paid / not-refunded guards, and the
 * retry-access / resend-email delivery path. The library layer is mocked, so
 * the assertions are about decisions, not SQL.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/integrations/payments", () => ({
  getPaymentProvider: jest.fn(),
}));

jest.mock("@/lib/lms/registrations", () => ({
  getRegistrationById: jest.fn(),
  markRegistrationAccessRevoked: jest.fn(async () => ({})),
  markRegistrationRefunded: jest.fn(async () => ({})),
  recordPaymentEvent: jest.fn(async () => ({})),
  setEmailState: jest.fn(async () => ({})),
}));

jest.mock("@/lib/lms/checkout", () => ({
  fulfillRegistration: jest.fn(),
  prepareAccessDelivery: jest.fn(),
  revokePurchaseAccess: jest.fn(),
}));

jest.mock("@/lib/lms/checkoutMail", () => ({
  deliverCheckoutEmail: jest.fn(),
}));

const { getRegistrationById, setEmailState } = require("@/lib/lms/registrations");
const {
  fulfillRegistration,
  prepareAccessDelivery,
  revokePurchaseAccess,
} = require("@/lib/lms/checkout");
const { deliverCheckoutEmail } = require("@/lib/lms/checkoutMail");
const { getPaymentProvider } = require("@/lib/integrations/payments");

const { POST } = require("@/app/api/lms/registrations/[id]/route");

const act = (id, body) =>
  POST(
    new Request(`http://localhost/api/lms/registrations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: { id } },
  );
const readJson = (res) => res.json();

const paid = {
  id: "reg-1",
  status: "paid",
  access_status: "pending",
  course_id: "crs-1",
  user_cid: "U-1",
  reference: "REF-1",
  run_id: 7,
  provider: "kkiapay",
  provider_transaction_id: "tx-1",
};

beforeEach(() => {
  jest.clearAllMocks();
  getRegistrationById.mockResolvedValue(paid);
});

describe("guards", () => {
  test("an unknown registration is a 404", async () => {
    getRegistrationById.mockResolvedValue(null);
    const res = await act("missing", { action: "refund" });
    expect(res.status).toBe(404);
  });

  test("an unknown action is refused (400)", async () => {
    const res = await act("reg-1", { action: "explode" });
    expect(res.status).toBe(400);
  });

  test("refunding a registration that is not paid is refused (409)", async () => {
    getRegistrationById.mockResolvedValue({ ...paid, status: "pending" });
    const res = await act("reg-1", { action: "refund" });
    expect(res.status).toBe(409);
    expect(getPaymentProvider).not.toHaveBeenCalled();
  });

  test("revoking access before a refund is refused (409)", async () => {
    const res = await act("reg-1", { action: "revoke-access" });
    expect(res.status).toBe(409);
    expect(revokePurchaseAccess).not.toHaveBeenCalled();
  });
});

describe("refund", () => {
  test("a successful refund marks the registration and keeps the access", async () => {
    getPaymentProvider.mockReturnValue({ refundTransaction: jest.fn(async () => ({ ok: true })) });
    const res = await act("reg-1", { action: "refund" });
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, status: "refunded", access_revoked: false });
    expect(revokePurchaseAccess).not.toHaveBeenCalled();
  });

  test("a provider refusal is a 502 and nothing is marked", async () => {
    getPaymentProvider.mockReturnValue({ refundTransaction: jest.fn(async () => ({ ok: false, error: "lms.errors.refundFailed" })) });
    const res = await act("reg-1", { action: "refund" });
    expect(res.status).toBe(502);
  });

  test("revokeAccess: true refunds and revokes in one step", async () => {
    getPaymentProvider.mockReturnValue({ refundTransaction: jest.fn(async () => ({ ok: true })) });
    revokePurchaseAccess.mockResolvedValue({ revoked: true });
    const res = await act("reg-1", { action: "refund", revokeAccess: true });
    const data = await readJson(res);
    expect(data.access_revoked).toBe(true);
    expect(revokePurchaseAccess).toHaveBeenCalledWith({ courseId: "crs-1", userCid: "U-1" });
  });
});

describe("retry-access / resend-email", () => {
  test("when the access is not yet granted, the access step is replayed then emailed", async () => {
    fulfillRegistration.mockResolvedValue({ ok: true, accessToken: "fresh-token" });
    deliverCheckoutEmail.mockResolvedValue({ sent: true, error: null });

    const res = await act("reg-1", { action: "retry-access" });
    const data = await readJson(res);

    expect(res.status).toBe(200);
    expect(fulfillRegistration).toHaveBeenCalledWith("reg-1");
    expect(deliverCheckoutEmail).toHaveBeenCalledWith({
      registration: expect.objectContaining({ id: "reg-1" }),
      accessToken: "fresh-token",
    });
    expect(setEmailState).toHaveBeenCalledWith("reg-1", { status: "sent" });
    expect(data.email_sent).toBe(true);
  });

  test("when the access is already granted, a fresh link is prepared (no re-fulfil)", async () => {
    getRegistrationById.mockResolvedValue({ ...paid, access_status: "granted" });
    prepareAccessDelivery.mockResolvedValue({ accessToken: "resume-token" });
    deliverCheckoutEmail.mockResolvedValue({ sent: true, error: null });

    const res = await act("reg-1", { action: "resend-email" });
    expect(res.status).toBe(200);
    expect(fulfillRegistration).not.toHaveBeenCalled();
    expect(prepareAccessDelivery).toHaveBeenCalled();
  });

  test("a failed delivery is recorded as a failed email, not a success", async () => {
    getRegistrationById.mockResolvedValue({ ...paid, access_status: "granted" });
    prepareAccessDelivery.mockResolvedValue({ accessToken: "t" });
    deliverCheckoutEmail.mockResolvedValue({ sent: false, error: "smtp" });

    const res = await act("reg-1", { action: "resend-email" });
    const data = await readJson(res);
    expect(data.email_sent).toBe(false);
    expect(setEmailState).toHaveBeenCalledWith("reg-1", { status: "failed" });
  });

  test("retrying a registration that is not paid is refused (409)", async () => {
    getRegistrationById.mockResolvedValue({ ...paid, status: "pending" });
    const res = await act("reg-1", { action: "retry-access" });
    expect(res.status).toBe(409);
  });
});
