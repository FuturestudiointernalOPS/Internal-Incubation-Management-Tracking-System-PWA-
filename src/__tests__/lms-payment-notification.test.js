/**
 * LMS — the payment notification state machine.
 *
 * These decisions used to sit inline in `src/app/api/webhooks/kkiapay/route.js`.
 * They now live in `src/services/lms/checkoutWebhook.js`. This suite pins the
 * observable behaviour: an unknown reference, a duplicate, an explicit failure,
 * an unverified success, a still-pending transaction, an amount mismatch, and a
 * settled payment.
 */

jest.mock("@/models/lms/registrations", () => ({
  getRegistrationByReference: jest.fn(),
  getRegistrationByTransactionId: jest.fn(),
  markRegistrationFailed: jest.fn(async () => ({})),
  recordPaymentEvent: jest.fn(async () => ({})),
}));

jest.mock("@/services/lms/checkout", () => ({
  settleVerifiedPayment: jest.fn(),
}));

const registrations = require("@/models/lms/registrations");
const { settleVerifiedPayment } = require("@/services/lms/checkout");
const { processPaymentNotification } = require("@/services/lms/checkoutWebhook");

const body = { event: "transaction.success" };

function provider(overrides = {}) {
  return { name: "kkiapay", verifyTransaction: jest.fn(), ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  registrations.getRegistrationByReference.mockResolvedValue(null);
  registrations.getRegistrationByTransactionId.mockResolvedValue(null);
});

describe("processPaymentNotification", () => {
  it("journals an unknown reference and never creates a registration", async () => {
    const result = await processPaymentNotification({
      provider: provider(),
      event: { reference: "REF-1", transactionId: "TX-1" },
      body,
    });

    expect(result).toEqual({ outcome: "unknown_reference" });
    expect(registrations.recordPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ignored", message: "unknown_reference" }),
    );
  });

  it("ignores a duplicate on an already-paid registration", async () => {
    registrations.getRegistrationByReference.mockResolvedValue({ id: 1, status: "paid" });

    const result = await processPaymentNotification({
      provider: provider(),
      event: { reference: "REF-1" },
      body,
    });

    expect(result).toEqual({ outcome: "duplicate" });
    expect(registrations.recordPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "notification_duplicate", status: "ignored", message: "duplicate" }),
    );
  });

  it("records an explicit failure without verifying", async () => {
    registrations.getRegistrationByReference.mockResolvedValue({ id: 1, status: "pending" });
    const p = provider();

    const result = await processPaymentNotification({
      provider: p,
      event: { reference: "REF-1", transactionId: "TX-1", isExplicitFailure: true },
      body,
    });

    expect(result).toEqual({ outcome: "explicit_failure" });
    expect(registrations.markRegistrationFailed).toHaveBeenCalledWith(1, {
      transactionId: "TX-1",
      partnerId: undefined,
    });
    expect(p.verifyTransaction).not.toHaveBeenCalled();
  });

  it("journals a failed verification and lets the sweep retry", async () => {
    registrations.getRegistrationByReference.mockResolvedValue({ id: 1, status: "pending" });
    const p = provider({ verifyTransaction: jest.fn(async () => ({ ok: false, error: "timeout" })) });

    const result = await processPaymentNotification({
      provider: p,
      event: { reference: "REF-1", transactionId: "TX-1" },
      body,
    });

    expect(result).toEqual({ outcome: "verification_failed" });
    expect(registrations.recordPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", message: "timeout" }),
    );
  });

  it("leaves a not-yet-settled transaction pending", async () => {
    registrations.getRegistrationByReference.mockResolvedValue({ id: 1, status: "pending" });
    const p = provider({ verifyTransaction: jest.fn(async () => ({ ok: true, isSuccess: false, status: "PENDING" })) });

    const result = await processPaymentNotification({
      provider: p,
      event: { reference: "REF-1", transactionId: "TX-1" },
      body,
    });

    expect(result).toEqual({ outcome: "pending", verifiedStatus: "PENDING" });
    expect(registrations.recordPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processed", message: "verified_status:PENDING" }),
    );
  });

  it("reports an amount mismatch from the shared settlement", async () => {
    registrations.getRegistrationByReference.mockResolvedValue({ id: 1, status: "pending" });
    const p = provider({ verifyTransaction: jest.fn(async () => ({ ok: true, isSuccess: true })) });
    settleVerifiedPayment.mockResolvedValue({ ok: false, reason: "amount_mismatch" });

    const result = await processPaymentNotification({
      provider: p,
      event: { reference: "REF-1", transactionId: "TX-1" },
      body,
    });

    expect(result).toEqual({ outcome: "amount_mismatch", reason: "amount_mismatch" });
  });

  it("settles a verified success", async () => {
    const registration = { id: 1, status: "pending", reference: "REF-1", run_id: 5 };
    registrations.getRegistrationByReference.mockResolvedValue(registration);
    const p = provider({ verifyTransaction: jest.fn(async () => ({ ok: true, isSuccess: true })) });
    settleVerifiedPayment.mockResolvedValue({
      ok: true,
      fulfillment: { ok: true },
      delivery: { sent: true },
    });

    const result = await processPaymentNotification({
      provider: p,
      event: { reference: "REF-1", transactionId: "TX-1", amount: 25000 },
      body,
    });

    expect(result).toEqual({ outcome: "paid", fulfillment: { ok: true }, delivery: { sent: true } });
    expect(settleVerifiedPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        registration,
        eventType: "notification",
        journalTransactionId: "TX-1",
        journalAmount: 25000,
        payload: body,
      }),
    );
  });
});
