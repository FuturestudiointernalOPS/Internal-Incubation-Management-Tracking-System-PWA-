/**
 * WhatsApp webhook — the public door.
 *
 * Meta holds no session, so the two things that must never regress are:
 *   - the verification handshake only answers the configured token;
 *   - a POST is accepted ONLY with a valid HMAC over the raw body.
 *
 * A webhook that accepted unsigned payloads would let anyone withdraw a
 * person's consent or forge a "delivered" status.
 */

import crypto from "crypto";

jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => true) }));

jest.mock("@/lib/integrations/whatsapp/config", () => ({
  whatsappAppSecret: jest.fn(),
  whatsappVerifyToken: jest.fn(),
}));

jest.mock("@/services/communications/whatsappInbound", () => ({
  handleWhatsappWebhookPayload: jest.fn(async () => ({ messages: 0, statuses: 0, optOuts: 0 })),
}));

const { initDb } = require("@/lib/db");
const {
  whatsappAppSecret,
  whatsappVerifyToken,
} = require("@/lib/integrations/whatsapp/config");
const { handleWhatsappWebhookPayload } = require("@/services/communications/whatsappInbound");
const { GET, POST } = require("@/app/api/integrations/whatsapp/webhook/route");

const BASE = "http://localhost/api/integrations/whatsapp/webhook";

const getRequest = (query) => new Request(`${BASE}?${query}`);
const postRequest = (body, signature) =>
  new Request(BASE, {
    method: "POST",
    body,
    headers: signature ? { "x-hub-signature-256": signature } : {},
  });

const sign = (body, secret) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

beforeEach(() => {
  jest.clearAllMocks();
  whatsappVerifyToken.mockReturnValue("verify-token");
  whatsappAppSecret.mockReturnValue("app-secret");
});

describe("GET — the verification handshake", () => {
  test("echoes the challenge when the token matches", async () => {
    const response = await GET(
      getRequest("hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=12345"),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  test("refuses a wrong token", async () => {
    const response = await GET(
      getRequest("hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345"),
    );
    expect(response.status).toBe(403);
  });

  test("fails closed when no token is configured", async () => {
    whatsappVerifyToken.mockReturnValue("");
    const response = await GET(
      getRequest("hub.mode=subscribe&hub.verify_token=&hub.challenge=12345"),
    );
    expect(response.status).toBe(503);
  });
});

describe("POST — signed deliveries", () => {
  test("accepts a valid signature and processes the payload", async () => {
    const body = JSON.stringify({ entry: [] });
    const response = await POST(postRequest(body, sign(body, "app-secret")));

    expect(response.status).toBe(200);
    expect(initDb).toHaveBeenCalled();
    expect(handleWhatsappWebhookPayload).toHaveBeenCalledWith({ entry: [] });
  });

  test("rejects a missing or wrong signature without processing anything", async () => {
    const body = JSON.stringify({ entry: [] });

    expect((await POST(postRequest(body, null))).status).toBe(401);
    expect((await POST(postRequest(body, "sha256=deadbeef"))).status).toBe(401);
    expect(handleWhatsappWebhookPayload).not.toHaveBeenCalled();
  });

  test("rejects a body altered after signing", async () => {
    const signed = JSON.stringify({ entry: [] });
    const altered = JSON.stringify({ entry: [{ id: "forged" }] });

    const response = await POST(postRequest(altered, sign(signed, "app-secret")));
    expect(response.status).toBe(401);
    expect(handleWhatsappWebhookPayload).not.toHaveBeenCalled();
  });

  test("fails closed when no app secret is configured", async () => {
    whatsappAppSecret.mockReturnValue("");
    const body = JSON.stringify({ entry: [] });
    const response = await POST(postRequest(body, sign(body, "app-secret")));
    expect(response.status).toBe(503);
  });

  test("a processing failure answers 500 so Meta retries", async () => {
    const body = JSON.stringify({ entry: [] });
    handleWhatsappWebhookPayload.mockRejectedValueOnce(new Error("db down"));

    const response = await POST(postRequest(body, sign(body, "app-secret")));
    expect(response.status).toBe(500);
  });
});
