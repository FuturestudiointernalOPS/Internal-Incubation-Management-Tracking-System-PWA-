/**
 * WhatsApp inbound — replies, delivery statuses and STOP.
 *
 * A STOP that is not honoured is what turns a helpful channel into a reported
 * number. These tests pin that the keyword is matched as a WHOLE message, that
 * a known sender's consent is actually withdrawn, and that delivery statuses
 * update the outbound row instead of creating a new one.
 */

jest.mock("@/models/contacts/whatsapp", () => ({
  findContactByPhoneDigits: jest.fn(),
  insertWhatsappLog: jest.fn(),
  updateWhatsappLogStatus: jest.fn(),
}));

jest.mock("@/services/communications/whatsappConsent", () => ({
  withdrawWhatsappConsent: jest.fn(),
  WHATSAPP_CONSENT_SOURCES: { STOP: "whatsapp:stop" },
}));

const models = require("@/models/contacts/whatsapp");
const { withdrawWhatsappConsent } = require("@/services/communications/whatsappConsent");
const {
  isWhatsappOptOutMessage,
  handleWhatsappWebhookPayload,
} = require("@/services/communications/whatsappInbound");

const inbound = (body, from = "2290196123456") => ({
  entry: [
    {
      changes: [
        {
          value: {
            messages: [
              {
                from,
                id: "wamid.inbound.1",
                type: "text",
                text: { body },
              },
            ],
          },
        },
      ],
    },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  models.findContactByPhoneDigits.mockResolvedValue({ rows: [] });
  models.insertWhatsappLog.mockResolvedValue({ rows: [] });
  models.updateWhatsappLogStatus.mockResolvedValue({ rows: [] });
  withdrawWhatsappConsent.mockResolvedValue({ ok: true, opted_in: false });
});

describe("isWhatsappOptOutMessage", () => {
  test("recognises the keyword in French and English, with punctuation and accents", () => {
    expect(isWhatsappOptOutMessage("STOP")).toBe(true);
    expect(isWhatsappOptOutMessage(" stop. ")).toBe(true);
    expect(isWhatsappOptOutMessage("Arrêter")).toBe(true);
    expect(isWhatsappOptOutMessage("désabonner")).toBe(true);
    expect(isWhatsappOptOutMessage("unsubscribe")).toBe(true);
  });

  test("never treats a sentence containing the word as an opt-out", () => {
    expect(isWhatsappOptOutMessage("I will stop by tomorrow")).toBe(false);
    expect(isWhatsappOptOutMessage("please do not stop the course")).toBe(false);
    expect(isWhatsappOptOutMessage("")).toBe(false);
  });
});

describe("handleWhatsappWebhookPayload — messages", () => {
  test("withdraws consent when a known contact sends STOP", async () => {
    models.findContactByPhoneDigits.mockResolvedValue({
      rows: [{ cid: "USR-1", phone: "+2290196123456" }],
    });

    const summary = await handleWhatsappWebhookPayload(inbound("STOP"));

    expect(withdrawWhatsappConsent).toHaveBeenCalledWith("USR-1", "whatsapp:stop");
    expect(models.insertWhatsappLog).toHaveBeenCalledWith(
      expect.objectContaining({
        contactCid: "USR-1",
        direction: "inbound",
        status: "opt_out",
        providerMessageId: "wamid.inbound.1",
      }),
    );
    expect(summary.optOuts).toBe(1);
  });

  test("records a normal reply without touching consent", async () => {
    models.findContactByPhoneDigits.mockResolvedValue({
      rows: [{ cid: "USR-1", phone: "+2290196123456" }],
    });

    const summary = await handleWhatsappWebhookPayload(inbound("Merci beaucoup"));

    expect(withdrawWhatsappConsent).not.toHaveBeenCalled();
    expect(models.insertWhatsappLog).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "inbound", status: "received", contactCid: "USR-1" }),
    );
    expect(summary.messages).toBe(1);
  });

  test("still records a STOP from an unknown number, but withdraws nothing", async () => {
    const summary = await handleWhatsappWebhookPayload(inbound("STOP", "229000000000"));

    expect(withdrawWhatsappConsent).not.toHaveBeenCalled();
    expect(models.insertWhatsappLog).toHaveBeenCalledWith(
      expect.objectContaining({ contactCid: null, status: "opt_out" }),
    );
    expect(summary.optOuts).toBe(0);
  });

  test("one malformed entry does not discard the rest of the batch", async () => {
    models.findContactByPhoneDigits
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ rows: [{ cid: "USR-2" }] });

    const summary = await handleWhatsappWebhookPayload({
      entry: [
        { changes: [{ value: { messages: [{ id: "m1", from: "1" }] } }] },
        { changes: [{ value: { messages: [{ id: "m2", from: "2", type: "text", text: { body: "hi" } }] } }] },
      ],
    });

    expect(summary.messages).toBe(1);
    expect(models.insertWhatsappLog).toHaveBeenCalledTimes(1);
  });
});

describe("handleWhatsappWebhookPayload — delivery statuses", () => {
  test("applies each status to the outbound row, with the provider's reason", async () => {
    const summary = await handleWhatsappWebhookPayload({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: "wamid.out.1", status: "delivered" },
                  { id: "wamid.out.2", status: "failed", errors: [{ title: "Re-engagement required" }] },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(models.updateWhatsappLogStatus).toHaveBeenNthCalledWith(
      1,
      "wamid.out.1",
      "delivered",
      null,
    );
    expect(models.updateWhatsappLogStatus).toHaveBeenNthCalledWith(
      2,
      "wamid.out.2",
      "failed",
      "Re-engagement required",
    );
    expect(summary.statuses).toBe(2);
  });
});
