import crypto from "crypto";

/**
 * KKIAPAY ADAPTER
 *
 * The contract below is REPRODUCED from Kkiapay's own published server SDK
 * (`@kkiapay-org/nodejs-sdk`) and their documentation, so no third-party HTTP
 * client is pulled into this project:
 *
 *   base URL   sandbox -> https://api-sandbox.kkiapay.me
 *              live    -> https://api.kkiapay.me
 *   verify     POST /api/v1/transactions/status  { transactionId }
 *              headers: x-api-key (the PUBLIC key), x-secret-key, x-private-key
 *   refund     POST /api/v1/transactions/revert  { transactionId }
 *
 * Two INDEPENDENT guarantees are required before any access is granted:
 *   1. the callback really comes from Kkiapay — the `x-kkiapay-secret` header
 *      carries the WEBHOOK SECRET HASH configured on the Kkiapay dashboard,
 *      compared here in constant time; and
 *   2. the transaction is re-verified SERVER-SIDE by its id, and the amount the
 *      provider actually collected matches the price WE decided.
 *
 * A payment is NEVER trusted because a browser claimed success, and the
 * notification is NEVER the decider: a notification carries no status at all
 * (only `event` + `isPaymentSucces`), so anything short of an explicit failure
 * is handed to the verified response to settle.
 *
 * Every value is read from the environment — no key is ever hardcoded, no
 * placeholder production config is invented — and the adapter is INERT (it
 * refuses to confirm anything) until it is configured:
 *
 *   NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY   public key (widget `key` + `x-api-key`)
 *   KKIAPAY_PRIVATE_KEY              private key
 *   KKIAPAY_SECRET_KEY               API secret key (`x-secret-key`)
 *   KKIAPAY_WEBHOOK_SECRET           the webhook "secret hash" from the
 *                                    dashboard (`x-kkiapay-secret`) — this is a
 *                                    DIFFERENT secret from KKIAPAY_SECRET_KEY
 *   KKIAPAY_SANDBOX                  "true" = test mode; anything else = live
 */
const NAME = "kkiapay";

const SANDBOX_BASE = "https://api-sandbox.kkiapay.me";
const LIVE_BASE = "https://api.kkiapay.me";
const VERIFY_PATH = "/api/v1/transactions/status";
const REFUND_PATH = "/api/v1/transactions/revert";

const SUCCESS_STATUS = "success";

/** Kkiapay's own vocabulary for the notification events. */
const SUCCESS_EVENTS = new Set(["transaction.success"]);
const FAILURE_EVENTS = new Set(["transaction.failed", "transaction.cancelled"]);

function config() {
  return {
    publicKey: process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY || null,
    privateKey: process.env.KKIAPAY_PRIVATE_KEY || null,
    secretKey: process.env.KKIAPAY_SECRET_KEY || null,
    webhookSecret: process.env.KKIAPAY_WEBHOOK_SECRET || null,
    sandbox: String(process.env.KKIAPAY_SANDBOX || "").toLowerCase() === "true",
  };
}

function apiBase(current) {
  return current.sandbox ? SANDBOX_BASE : LIVE_BASE;
}

/** Constant-time string comparison; different lengths are never equal. */
export function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ""));
  const right = Buffer.from(String(rightValue || ""));
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** First non-empty value among the candidate keys. */
function pickValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

/** True only for an unambiguous provider-side failure. */
function isExplicitFailure(body) {
  if (body?.isPaymentSucces === false) return true;
  const event = String(body?.event || "").toLowerCase();
  return FAILURE_EVENTS.has(event);
}

/** True when the notification itself says "success" — useful, never decisive. */
function claimsSuccess(body) {
  if (body?.isPaymentSucces === true) return true;
  return SUCCESS_EVENTS.has(String(body?.event || "").toLowerCase());
}

export const kkiapayProvider = {
  name: NAME,

  /** What the browser widget needs, and nothing more. The widget wants `key`. */
  publicConfig() {
    const current = config();
    return { provider: NAME, key: current.publicKey, sandbox: current.sandbox };
  },

  /** All four values present -> the provider can be trusted end to end. */
  isConfigured() {
    const current = config();
    return Boolean(current.publicKey && current.privateKey && current.secretKey && current.webhookSecret);
  },

  canVerifyWebhook() {
    return Boolean(config().webhookSecret);
  },

  canVerifyTransaction() {
    const current = config();
    return Boolean(current.publicKey && current.privateKey && current.secretKey);
  },

  /** Guarantee 1 — does the callback really come from Kkiapay? */
  verifyWebhookSignature(request) {
    const current = config();
    if (!current.webhookSecret) return false;
    return safeEqual(request?.headers?.get?.("x-kkiapay-secret"), current.webhookSecret);
  },

  /**
   * Normalize the notification. It carries NO status: only `event`,
   * `isPaymentSucces`, `transactionId`, `partnerId`, `amount` and the customer
   * fields. `partnerId` is what we set on the widget (the registration
   * reference), and it comes back here AND in the verified response — a second
   * path to the registration when the reference does not survive the round trip.
   */
  parseWebhook(body) {
    const transactionId = pickValue(body, ["transactionId", "transaction_id", "id"]);
    const partnerId = pickValue(body, ["partnerId", "partner_id"]);
    // `data` is accepted as a fallback only: it is not documented in the
    // notification, partnerId is.
    const reference = partnerId || pickValue(body, ["data", "reference"]);
    const rawAmount = pickValue(body, ["amount"]);
    const amount = rawAmount == null ? null : Number(rawAmount);
    const event = String(body?.event || "").toLowerCase();

    return {
      transactionId: transactionId ? String(transactionId) : null,
      partnerId: partnerId ? String(partnerId) : null,
      reference: reference ? String(reference) : null,
      amount: Number.isFinite(amount) ? amount : null,
      event,
      claimsSuccess: claimsSuccess(body),
      isExplicitFailure: isExplicitFailure(body),
      raw: body,
    };
  },

  isExplicitFailure(body) {
    return isExplicitFailure(body);
  },

  /**
   * Guarantee 2 — the truth. Asks Kkiapay what really happened, by transaction
   * id, with the server credentials. THIS result decides; the notification only
   * provides the trigger.
   */
  async verifyTransaction(transactionId) {
    const current = config();
    if (!this.canVerifyTransaction()) {
      return { ok: false, error: "lms.errors.paymentProviderNotConfigured" };
    }
    if (!transactionId) {
      return { ok: false, error: "lms.errors.paymentTransactionUnknown" };
    }

    try {
      const response = await fetch(`${apiBase(current)}${VERIFY_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": current.publicKey,
          "x-secret-key": current.secretKey,
          "x-private-key": current.privateKey,
        },
        body: JSON.stringify({ transactionId }),
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        return { ok: false, error: "lms.errors.paymentVerificationFailed" };
      }

      const status = String(pickValue(payload, ["status"]) || "").toLowerCase();
      const rawAmount = pickValue(payload, ["amount"]);
      const amount = Number(rawAmount);
      const partnerId = pickValue(payload, ["partnerId", "partner_id"]);

      return {
        ok: true,
        status,
        isSuccess: status === SUCCESS_STATUS,
        amount: Number.isFinite(amount) ? amount : null,
        partnerId: partnerId ? String(partnerId) : null,
        raw: payload,
      };
    } catch (error) {
      return {
        ok: false,
        error: "lms.errors.paymentVerificationFailed",
        detail: String(error?.message || error),
      };
    }
  },

  /** Refund a transaction. Returns the provider's own answer, never a guess. */
  async refundTransaction(transactionId) {
    const current = config();
    if (!this.canVerifyTransaction()) {
      return { ok: false, error: "lms.errors.paymentProviderNotConfigured" };
    }
    if (!transactionId) return { ok: false, error: "lms.errors.paymentTransactionUnknown" };

    try {
      const response = await fetch(`${apiBase(current)}${REFUND_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": current.publicKey,
          "x-secret-key": current.secretKey,
          "x-private-key": current.privateKey,
        },
        body: JSON.stringify({ transactionId }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, error: "lms.errors.refundFailed", raw: payload };
      }
      return { ok: true, raw: payload };
    } catch (error) {
      return { ok: false, error: "lms.errors.refundFailed", detail: String(error?.message || error) };
    }
  },
};
