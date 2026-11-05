/**
 * WhatsApp consent + outbound guards — the behaviour that protects the number.
 *
 * The rules under test, in the order they protect the sender:
 *   - no consent, no message;
 *   - no usable number, no stored consent;
 *   - the channel stays off until explicitly enabled AND configured;
 *   - a daily cap and a per-contact cooldown are enforced from the log;
 *   - every real attempt is logged, success or failure.
 */

jest.mock("@/models/contacts/whatsapp", () => ({
  getContactWhatsappFields: jest.fn(),
  getWhatsappConsent: jest.fn(),
  upsertWhatsappConsent: jest.fn(),
  getWhatsappConsentsForCids: jest.fn(),
  countWhatsappOutboundSince: jest.fn(),
  findWhatsappOutboundForContactSince: jest.fn(),
  insertWhatsappLog: jest.fn(),
}));

jest.mock("@/lib/integrations/whatsapp/send", () => ({
  sendWhatsappTemplate: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const models = require("@/models/contacts/whatsapp");
const { sendWhatsappTemplate } = require("@/lib/integrations/whatsapp/send");
const {
  setWhatsappConsent,
  readWhatsappConsent,
  WHATSAPP_CONSENT_SOURCES,
} = require("@/services/communications/whatsappConsent");
const {
  sendWhatsappTemplateToContact,
} = require("@/services/communications/whatsappOutbound");

const CONTACT = {
  cid: "USR-1",
  phone: "+2290196123456",
  whatsapp_opt_in: true,
  deleted: 0,
};

const ENABLE_API = () => {
  process.env.WHATSAPP_API_ENABLED = "true";
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "test-phone-id";
};

beforeEach(() => {
  jest.clearAllMocks();
  models.getContactWhatsappFields.mockResolvedValue({ rows: [] });
  models.getWhatsappConsent.mockResolvedValue({ rows: [] });
  models.upsertWhatsappConsent.mockResolvedValue({ rows: [] });
  models.countWhatsappOutboundSince.mockResolvedValue({ rows: [{ count: 0 }] });
  models.findWhatsappOutboundForContactSince.mockResolvedValue({ rows: [] });
  models.insertWhatsappLog.mockResolvedValue({ rows: [] });
  sendWhatsappTemplate.mockResolvedValue({
    success: true,
    provider: "whatsapp",
    messageId: "wamid-1",
  });

  delete process.env.WHATSAPP_API_ENABLED;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_DAILY_CAP;
  delete process.env.WHATSAPP_CONTACT_COOLDOWN_HOURS;
});

afterAll(() => {
  delete process.env.WHATSAPP_API_ENABLED;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_DAILY_CAP;
  delete process.env.WHATSAPP_CONTACT_COOLDOWN_HOURS;
});

describe("setWhatsappConsent", () => {
  test("records an opt-in when a valid number is supplied", async () => {
    const result = await setWhatsappConsent({
      cid: "USR-1",
      accepted: true,
      source: WHATSAPP_CONSENT_SOURCES.PROFILE,
      phone: "+2290196123456",
    });

    expect(result).toEqual({ ok: true, opted_in: true });
    expect(models.upsertWhatsappConsent).toHaveBeenCalledWith(
      "USR-1",
      true,
      "profile",
    );
    expect(models.getContactWhatsappFields).not.toHaveBeenCalled();
  });

  test("falls back to the stored number when the form supplies none", async () => {
    models.getContactWhatsappFields.mockResolvedValue({
      rows: [{ cid: "USR-1", phone: "0196123456", country_code: "BJ" }],
    });

    const result = await setWhatsappConsent({
      cid: "USR-1",
      accepted: true,
      source: "registration:participant",
    });

    expect(result.ok).toBe(true);
    expect(models.upsertWhatsappConsent).toHaveBeenCalledWith(
      "USR-1",
      true,
      "registration:participant",
    );
  });

  test("refuses to store an opt-in on a number that cannot resolve", async () => {
    const result = await setWhatsappConsent({
      cid: "USR-1",
      accepted: true,
      source: "profile",
      phone: "12345",
    });

    expect(result).toEqual({ ok: false, reason: "phone_required" });
    expect(models.upsertWhatsappConsent).not.toHaveBeenCalled();
  });

  test("always allows an opt-out, even without a phone", async () => {
    const result = await setWhatsappConsent({
      cid: "USR-1",
      accepted: false,
      source: "profile",
    });

    expect(result).toEqual({ ok: true, opted_in: false });
    expect(models.upsertWhatsappConsent).toHaveBeenCalledWith(
      "USR-1",
      false,
      "profile",
    );
    expect(models.getContactWhatsappFields).not.toHaveBeenCalled();
  });
});

describe("readWhatsappConsent", () => {
  test("returns a safe default when there is no row", async () => {
    expect(await readWhatsappConsent("USR-1")).toEqual({
      opted_in: false,
      source: null,
      opted_in_at: null,
      opted_out_at: null,
    });
  });

  test("exposes the stored choice", async () => {
    models.getWhatsappConsent.mockResolvedValue({
      rows: [{ contact_cid: "USR-1", opt_in: 1, source: "profile", opted_in_at: "2026-01-01" }],
    });

    const consent = await readWhatsappConsent("USR-1");
    expect(consent.opted_in).toBe(true);
    expect(consent.source).toBe("profile");
  });
});

describe("sendWhatsappTemplateToContact", () => {
  test("never sends to a contact who has not consented", async () => {
    const result = await sendWhatsappTemplateToContact({
      contact: { ...CONTACT, whatsapp_opt_in: false },
      templateName: "reminder",
    });

    expect(result).toEqual({ success: false, skipped: true, reason: "no_consent" });
    expect(sendWhatsappTemplate).not.toHaveBeenCalled();
    expect(models.insertWhatsappLog).not.toHaveBeenCalled();
  });

  test("stays off until the channel is explicitly enabled and configured", async () => {
    const result = await sendWhatsappTemplateToContact({
      contact: CONTACT,
      templateName: "reminder",
    });

    expect(result).toEqual({ success: false, error: "whatsapp_not_configured" });
    expect(sendWhatsappTemplate).not.toHaveBeenCalled();
  });

  test("refuses once the rolling 24-hour cap is reached", async () => {
    ENABLE_API();
    process.env.WHATSAPP_DAILY_CAP = "10";
    models.countWhatsappOutboundSince.mockResolvedValue({ rows: [{ count: 10 }] });

    const result = await sendWhatsappTemplateToContact({
      contact: CONTACT,
      templateName: "reminder",
    });

    expect(result).toEqual({ success: false, error: "whatsapp_daily_cap_reached" });
    expect(sendWhatsappTemplate).not.toHaveBeenCalled();
  });

  test("refuses inside the per-contact cooldown", async () => {
    ENABLE_API();
    models.findWhatsappOutboundForContactSince.mockResolvedValue({
      rows: [{ id: 1 }],
    });

    const result = await sendWhatsappTemplateToContact({
      contact: CONTACT,
      templateName: "reminder",
    });

    expect(result).toEqual({ success: false, error: "whatsapp_cooldown_active" });
    expect(sendWhatsappTemplate).not.toHaveBeenCalled();
  });

  test("sends the template and logs a successful attempt", async () => {
    ENABLE_API();

    const result = await sendWhatsappTemplateToContact({
      contact: CONTACT,
      templateName: "reminder",
      languageCode: "fr",
    });

    expect(result.success).toBe(true);
    expect(sendWhatsappTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+2290196123456",
        templateName: "reminder",
        languageCode: "fr",
      }),
    );
    expect(models.insertWhatsappLog).toHaveBeenCalledWith(
      expect.objectContaining({
        contactCid: "USR-1",
        templateName: "reminder",
        status: "sent",
        providerMessageId: "wamid-1",
        recipient: "+2290196123456",
      }),
    );
  });

  test("logs a failed attempt rather than pretending it went out", async () => {
    ENABLE_API();
    sendWhatsappTemplate.mockResolvedValue({
      success: false,
      provider: "whatsapp",
      error: "template rejected",
    });

    const result = await sendWhatsappTemplateToContact({
      contact: CONTACT,
      templateName: "reminder",
    });

    expect(result.success).toBe(false);
    expect(models.insertWhatsappLog).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error: "template rejected",
        sentAt: null,
      }),
    );
  });
});
