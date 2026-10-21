/**
 * VENTURE WORKSPACE — theme legibility.
 *
 * The founder workspace shares two style objects between all of its forms.
 * They used to carry dark-mode literals (a slate-900 field background) while
 * the text colour came from `var(--text-primary)`. In light mode that painted
 * dark navy text on a dark navy field. These tests pin the tokens, so the
 * regression cannot come back unnoticed.
 */

const {
  inputStyle,
  cardStyle,
} = require("@/components/participant/ventures/ventureScreenHelpers");

describe("venture workspace theme tokens", () => {
  test("form fields use the active theme, not a dark-mode literal", () => {
    expect(inputStyle).toEqual({
      backgroundColor: "var(--surface-1)",
      borderColor: "var(--border-primary)",
      color: "var(--text-primary)",
    });
  });

  test("shared cards use the active theme too", () => {
    expect(cardStyle).toEqual({
      backgroundColor: "var(--surface-1)",
      borderColor: "var(--border-primary)",
    });
  });

  test("no hardcoded colour survives in the shared styles", () => {
    for (const style of [inputStyle, cardStyle]) {
      for (const value of Object.values(style)) {
        expect(value).toMatch(/^var\(--/);
      }
    }
  });
});
