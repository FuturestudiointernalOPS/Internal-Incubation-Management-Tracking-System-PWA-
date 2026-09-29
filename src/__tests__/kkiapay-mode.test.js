/**
 * PAYMENT MODE — sandbox vs live.
 *
 * The mode is read from KKIAPAY_SANDBOX: `true` (surrounding whitespace
 * tolerated) = test; anything else — `false`, unset — = live. This is the switch
 * an operator flips to take real payments, so both ends are pinned here: the
 * flag the browser widget receives AND the server base URL the verification
 * posts to must follow the SAME value.
 */

const { kkiapayProvider } = require("@/lib/integrations/payments");

const ENV_KEYS = [
  "NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY",
  "KKIAPAY_PRIVATE_KEY",
  "KKIAPAY_SECRET_KEY",
  "KKIAPAY_WEBHOOK_SECRET",
  "KKIAPAY_SANDBOX",
];

const SANDBOX_VERIFY_URL = "https://api-sandbox.kkiapay.me/api/v1/transactions/status";
const LIVE_VERIFY_URL = "https://api.kkiapay.me/api/v1/transactions/status";

let originalFetch;

beforeEach(() => {
  originalFetch = global.fetch;
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY = "pub";
  process.env.KKIAPAY_PRIVATE_KEY = "priv";
  process.env.KKIAPAY_SECRET_KEY = "secret";
  process.env.KKIAPAY_WEBHOOK_SECRET = "webhook";
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of ENV_KEYS) delete process.env[key];
});

/** Run a verification and return the server URL it actually called. */
async function verifiedUrl() {
  const calls = [];
  global.fetch = jest.fn(async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ status: "success", amount: 1000 }) };
  });

  await kkiapayProvider.verifyTransaction("TXN-1");
  return calls[0];
}

describe("payment mode", () => {
  test("KKIAPAY_SANDBOX=true → sandbox widget and sandbox API", async () => {
    process.env.KKIAPAY_SANDBOX = "true";

    expect(kkiapayProvider.publicConfig().sandbox).toBe(true);
    expect(await verifiedUrl()).toBe(SANDBOX_VERIFY_URL);
  });

  test("KKIAPAY_SANDBOX=false → live widget and live API", async () => {
    process.env.KKIAPAY_SANDBOX = "false";

    expect(kkiapayProvider.publicConfig().sandbox).toBe(false);
    expect(await verifiedUrl()).toBe(LIVE_VERIFY_URL);
  });

  test("unset → live (what a fresh deployment gets by default)", async () => {
    expect(kkiapayProvider.publicConfig().sandbox).toBe(false);
    expect(await verifiedUrl()).toBe(LIVE_VERIFY_URL);
  });

  test("a stray space around `true` is still test mode", async () => {
    process.env.KKIAPAY_SANDBOX = " true ";

    expect(kkiapayProvider.publicConfig().sandbox).toBe(true);
    expect(await verifiedUrl()).toBe(SANDBOX_VERIFY_URL);
  });
});
