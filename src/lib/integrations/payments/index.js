import { kkiapayProvider } from "./kkiapay";

/**
 * PAYMENT PROVIDER REGISTRY
 *
 * The registration -> payment -> access chain is provider-AGNOSTIC: a
 * registration is created and referenced before any provider is involved, and
 * the provider is only the mechanism that completes the payment. Adding
 * Paystack / Flutterwave / CinetPay later means adding an adapter here — never
 * touching the registration model or the fulfillment step.
 *
 * An adapter must expose:
 *   name, publicConfig(), isConfigured(), canVerifyWebhook(),
 *   canVerifyTransaction(), verifyWebhookSignature(request), parseWebhook(body),
 *   isExplicitFailure(body), verifyTransaction(id), refundTransaction(id).
 */
const PROVIDERS = {
  [kkiapayProvider.name]: kkiapayProvider,
};

export function getPaymentProvider(name) {
  const key = String(name || "").trim().toLowerCase();
  return PROVIDERS[key] || null;
}

/**
 * The provider used unless the environment overrides it. Falls back to Kkiapay
 * so the checkout never 500s on a missing/typo'd PAYMENT_PROVIDER — the adapter
 * itself stays INERT until it is configured.
 */
export function defaultPaymentProvider() {
  return getPaymentProvider(process.env.PAYMENT_PROVIDER || "kkiapay") || kkiapayProvider;
}

export { kkiapayProvider };
