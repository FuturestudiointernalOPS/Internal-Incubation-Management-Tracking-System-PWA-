/**
 * "Join our investors network" — the public lead form (seed contract).
 *
 * Locks the definition the studio asked for, so a later edit cannot silently
 * drop a question, a step, the confirmation message, or the consent gate.
 *
 * Static on purpose: the seed service imports the data layer, and this suite
 * asserts the DEFINITION without touching a database.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const SERVICE = read("src/services/platform/seed/investorNetworkForm.js");
const ROUTE = read("src/app/api/platform/seed/investor-network/route.js");

describe("the investor network form definition", () => {
  test("three steps, in order", () => {
    const order = ["About you", "Your investment focus", "Anything else"].map((title) =>
      SERVICE.indexOf(`title: "${title}"`),
    );
    for (const position of order) expect(position).toBeGreaterThan(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("every question the studio asked for is present", () => {
    for (const label of [
      "Full name",
      "Email",
      "Organization or firm, and your role",
      "Country",
      "LinkedIn or website",
      "Type of investor",
      "Sectors you invest in",
      "Stages you invest at",
      "Regions you invest in",
      "Typical investment size (USD)",
      "Message",
      "How did you hear about us?",
    ]) {
      expect(SERVICE).toContain(label);
    }
    expect(SERVICE).toContain(
      "I agree to be contacted by Future Studio about investment opportunities.",
    );
  });

  test("the control types match the brief", () => {
    // Q4 and Q10 are dropdowns; Q7–Q9 are multi-selects; Q13 is a checkbox.
    expect(SERVICE).toMatch(/field_type: "select", label: "Country"/);
    expect(SERVICE).toMatch(/field_type: "select", label: "Type of investor", required: true/);
    expect(SERVICE).toMatch(/field_type: "multiselect",\s+label: "Sectors you invest in"/);
    expect(SERVICE).toMatch(/field_type: "multiselect",\s+label: "Stages you invest at"/);
    expect(SERVICE).toMatch(/field_type: "multiselect",\s+label: "Regions you invest in"/);
    expect(SERVICE).toMatch(/field_type: "select",\s+label: "Typical investment size \(USD\)"/);
    expect(SERVICE).toMatch(/field_type: "textarea", label: "Message"/);
    expect(SERVICE).toMatch(/field_type: "checkbox"/);
  });

  test("the required answers are the two the brief marks", () => {
    expect(SERVICE).toMatch(/label: "Full name", required: true/);
    expect(SERVICE).toMatch(/label: "Email", required: true/);
    expect(SERVICE).toMatch(/label: "Type of investor", required: true/);
    // Consent is required; everything else optional.
    const consent = SERVICE.slice(SERVICE.indexOf("I agree to be contacted"));
    expect(consent).toContain("required: true");
  });

  test("the option sets are complete", () => {
    for (const band of [
      "Under $25,000",
      "$25,000 – $100,000",
      "$100,000 – $500,000",
      "$500,000 – $1 million",
      "Over $1 million",
      "Prefer not to say",
    ]) {
      expect(SERVICE).toContain(band);
    }
    for (const region of [
      "Anywhere in Africa",
      "West Africa",
      "Central Africa",
      "East Africa",
      "Southern Africa",
      "North Africa",
    ]) {
      expect(SERVICE).toContain(region);
    }
    expect(SERVICE).toContain('label: "Any sector"');
    expect(SERVICE).toContain('label: "Any stage"');
  });

  test("it is a lead form, not the investor application", () => {
    // No flag, no provisioning: it must never compete with the single-form guard.
    expect(SERVICE).not.toContain("investor_application: true");
    expect(SERVICE).toMatch(/auto_approve: false/);
    expect(ROUTE).toMatch(/requireAnyAuthorization/);
    expect(ROUTE).toMatch(/module: "investor", capability: "create"/);
    expect(ROUTE).toMatch(/module: "settings", capability: "edit"/);
  });

  test("the confirmation message is the one requested", () => {
    expect(SERVICE).toContain(
      "Thank you. Our team will review your details and be in touch.",
    );
  });

  test("the admin screen offers the button, labelled in both languages", () => {
    expect(read("src/app/admin/investors/page.js")).toContain(
      "api/platform/seed/investor-network",
    );
    for (const lang of ["en", "fr"]) {
      const locale = JSON.parse(read(`src/locales/${lang}/investorAdmin.json`));
      expect(locale.investorAdmin.list.networkForm).toBeTruthy();
    }
  });
});
