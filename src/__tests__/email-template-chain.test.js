/**
 * Email template priority chain — run → form → platform default.
 *
 * This order was previously unpinned by any test: the run-level override, the
 * form-level designed default and the built-in fallback are three separate
 * sources, and resolution is per FIELD (subject and body fall through
 * independently). These tests lock that contract, including the confirmation
 * ("acknowledgement") key that now travels the same chain as the decision and
 * activation emails.
 */
const { getTemplate, getDesignedTemplate, applyTemplate, getDefaultTemplate } = require("@/lib/email");
const { templateVariableNames, findUnknownTemplateVariables } = require("@/lib/constants");

const formWith = (key, subject, body) => ({ automation: { templates: { [key]: { subject, body } } } });
const runWith = (key, subject, body) => ({ templates: { [key]: { subject, body } } });

const KEY = "acknowledgement";

describe("getTemplate — run → form → platform default", () => {
  test("the run override wins over the form on both fields", () => {
    const template = getTemplate(formWith(KEY, "Form subject", "Form body"), KEY, runWith(KEY, "Run subject", "Run body"));
    expect(template).toEqual({ subject: "Run subject", body: "Run body" });
  });

  test("a blank run value falls through to the form value", () => {
    const template = getTemplate(formWith(KEY, "Form subject", "Form body"), KEY, runWith(KEY, "", "   "));
    expect(template).toEqual({ subject: "Form subject", body: "Form body" });
  });

  test("subject and body fall through independently", () => {
    const template = getTemplate(formWith(KEY, "Form subject", "Form body"), KEY, runWith(KEY, "Run subject", ""));
    expect(template.subject).toBe("Run subject");
    expect(template.body).toBe("Form body");
  });

  test("a form-only design wins over the platform default", () => {
    const template = getTemplate(formWith(KEY, "Form subject", "Form body"), KEY, {});
    expect(template).toEqual({ subject: "Form subject", body: "Form body" });
  });

  test("with nothing configured the platform default is used", () => {
    const fallback = getDefaultTemplate(KEY);
    const template = getTemplate({}, KEY, {});
    expect(template).toEqual(fallback);
    expect(template.subject).not.toBe("");
    expect(template.body).not.toBe("");
  });

  test("a form entry that is entirely blank still leaves the default reachable", () => {
    const fallback = getDefaultTemplate(KEY);
    const template = getTemplate(formWith(KEY, "  ", ""), KEY, runWith(KEY, "", ""));
    expect(template).toEqual(fallback);
  });

  test("missing settings objects never throw", () => {
    expect(() => getTemplate(undefined, KEY, undefined)).not.toThrow();
    expect(() => getTemplate(null, KEY, null)).not.toThrow();
  });

  test("an unknown key resolves to empty strings, never undefined", () => {
    expect(getTemplate({}, "not_a_template_key", {})).toEqual({ subject: "", body: "" });
  });
});

describe("getDesignedTemplate — the designed levels only", () => {
  test("the run override wins over the form on both fields", () => {
    const out = getDesignedTemplate(formWith(KEY, "Form subject", "Form body"), KEY, runWith(KEY, "Run subject", "Run body"));
    expect(out).toEqual({ subject: "Run subject", body: "Run body" });
  });

  test("a blank run value falls through to the form value", () => {
    const out = getDesignedTemplate(formWith(KEY, "Form subject", ""), KEY, runWith(KEY, "   ", ""));
    expect(out).toEqual({ subject: "Form subject", body: "" });
  });

  test("with nothing designed it returns blanks, NOT the platform default", () => {
    // This is the whole point of the separate resolver: the result message's
    // built-in wording depends on the kind of run, so the platform default must
    // never be reached before that choice is made.
    expect(getDesignedTemplate({}, KEY, {})).toEqual({ subject: "", body: "" });
    expect(getTemplate({}, KEY, {})).not.toEqual({ subject: "", body: "" });
  });

  test("missing settings objects never throw", () => {
    expect(() => getDesignedTemplate(undefined, KEY, undefined)).not.toThrow();
    expect(getDesignedTemplate(null, KEY, null)).toEqual({ subject: "", body: "" });
  });

  test("the result key has a platform default (the base the AI personalizes)", () => {
    const fallback = getDefaultTemplate("result");
    expect(fallback.subject).not.toBe("");
    expect(fallback.body).not.toBe("");
  });
});

describe("applyTemplate — no placeholder ever ships raw", () => {
  test("replaces every occurrence of a variable", () => {
    expect(applyTemplate("Hi {{name}}, welcome {{name}}", { name: "Ada" })).toBe("Hi Ada, welcome Ada");
  });

  test("tolerates spaces inside the braces", () => {
    expect(applyTemplate("Hi {{ name }} from {{organization }}", { name: "Ada", organization: "FS" })).toBe("Hi Ada from FS");
  });

  test("a name the sender does not provide is REMOVED, not left verbatim", () => {
    // The whole point: a recipient must never read `{{organization}}`.
    expect(applyTemplate("Hi {{name}} from {{organization}}", { name: "Ada" })).toBe("Hi Ada from ");
  });

  test("an invented name is removed too", () => {
    expect(applyTemplate("Hi {{name}} ({{favourite_colour}})", { name: "Ada" })).toBe("Hi Ada ()");
  });

  test("a blank template stays blank", () => {
    expect(applyTemplate("", { name: "Ada" })).toBe("");
    expect(applyTemplate(null, { name: "Ada" })).toBe("");
  });

  test("text without placeholders is untouched", () => {
    expect(applyTemplate("Plain text, no braces.", { name: "Ada" })).toBe("Plain text, no braces.");
  });
});

describe("template variable inspection (shared with the editors)", () => {
  test("lists the names a text uses, in order and de-duplicated", () => {
    expect(templateVariableNames("{{name}} / {{ name }} / {{form_name}}")).toEqual(["name", "form_name"]);
  });

  test("a text without placeholders has no names", () => {
    expect(templateVariableNames("")).toEqual([]);
    expect(templateVariableNames(null)).toEqual([]);
    expect(templateVariableNames("nothing here")).toEqual([]);
  });

  test("flags only the names outside the accepted list", () => {
    const text = "Hi {{name}}, {{score}} out of {{organization}}";
    expect(findUnknownTemplateVariables(text, ["name", "organization"])).toEqual(["score"]);
    expect(findUnknownTemplateVariables(text, ["name", "score", "organization"])).toEqual([]);
  });

  test("an editor with no accepted list treats every name as unknown", () => {
    expect(findUnknownTemplateVariables("{{anything}}", [])).toEqual(["anything"]);
  });
});
