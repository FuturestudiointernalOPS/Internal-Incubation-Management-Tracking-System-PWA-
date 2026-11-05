/**
 * WhatsApp rules — the three gates and the link builder.
 *
 * These are the rules that keep a business number out of trouble: a valid
 * international number, an explicit consent, and a live record. They are pure,
 * so they are pinned here rather than through a screen.
 */

process.env.WHATSAPP_DEFAULT_COUNTRY = "BJ";

const { normalizeWhatsappPhone } = require("@/lib/integrations/whatsapp/phone");
const {
  evaluateWhatsappReachability,
  isWhatsappOptedIn,
} = require("@/lib/integrations/whatsapp/rules");
const { buildWhatsappLink } = require("@/lib/integrations/whatsapp/link");

const CONTACT = {
  cid: "USR-1",
  phone: "+2290196123456",
  whatsapp_opt_in: true,
};

describe("normalizeWhatsappPhone", () => {
  test("accepts an E.164 number and returns the digits wa.me expects", () => {
    expect(normalizeWhatsappPhone("+229 01 96 12 34 56")).toEqual({
      e164: "+2290196123456",
      digits: "2290196123456",
      country: "BJ",
    });
  });

  test("resolves a national number with the configured default country", () => {
    expect(normalizeWhatsappPhone("0196123456")?.e164).toBe("+2290196123456");
  });

  test("accepts an international number written with 00", () => {
    expect(normalizeWhatsappPhone("002290196123456")?.e164).toBe("+2290196123456");
  });

  test("refuses an invalid, incomplete or missing number", () => {
    expect(normalizeWhatsappPhone("")).toBeNull();
    expect(normalizeWhatsappPhone("12345")).toBeNull();
    expect(normalizeWhatsappPhone("not-a-number")).toBeNull();
    // 8-digit legacy Benin numbers are no longer valid since the 2022 plan.
    expect(normalizeWhatsappPhone("96123456")).toBeNull();
  });
});

describe("evaluateWhatsappReachability", () => {
  test("allows a consented contact with a valid number", () => {
    const result = evaluateWhatsappReachability(CONTACT);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.phone.digits).toBe("2290196123456");
  });

  test("refuses without consent, before looking at the number", () => {
    expect(
      evaluateWhatsappReachability({ ...CONTACT, whatsapp_opt_in: false }).reason,
    ).toBe("no_consent");
  });

  test("refuses an invalid number even when consent is present", () => {
    expect(evaluateWhatsappReachability({ ...CONTACT, phone: "123" }).reason).toBe(
      "invalid_phone",
    );
  });

  test("refuses an archived or deleted contact", () => {
    expect(
      evaluateWhatsappReachability({ ...CONTACT, archived_at: "2026-01-01" }).reason,
    ).toBe("inactive");
    expect(evaluateWhatsappReachability({ ...CONTACT, deleted: 1 }).reason).toBe(
      "inactive",
    );
  });

  test("reads the consent flag in every shape the database can return", () => {
    expect(isWhatsappOptedIn({ whatsapp_opt_in: true })).toBe(true);
    expect(isWhatsappOptedIn({ whatsapp_opt_in: 1 })).toBe(true);
    expect(isWhatsappOptedIn({ whatsapp_opt_in: "1" })).toBe(true);
    expect(isWhatsappOptedIn({ whatsapp_opt_in: 0 })).toBe(false);
    expect(isWhatsappOptedIn({})).toBe(false);
  });
});

describe("buildWhatsappLink", () => {
  test("encodes the prefilled message", () => {
    const link = buildWhatsappLink({
      phone: "+2290196123456",
      message: "Bonjour Ama & Kofi",
    });
    expect(link).toBe(
      "https://wa.me/2290196123456?text=Bonjour%20Ama%20%26%20Kofi",
    );
  });

  test("returns null instead of a link to a wrong number", () => {
    expect(buildWhatsappLink({ phone: "123", message: "hi" })).toBeNull();
  });

  test("omits the text when there is no message", () => {
    expect(buildWhatsappLink({ phone: "+2290196123456" })).toBe(
      "https://wa.me/2290196123456",
    );
  });
});
