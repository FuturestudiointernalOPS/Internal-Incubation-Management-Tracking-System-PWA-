/**
 * The project / company name that fills {{project_name}} in the result message.
 *
 * Its source is the candidate's own answers, and the questions are written by
 * whoever built the form — not by us. So every label a French or English form
 * realistically uses must resolve, and a label that merely MENTIONS the venture
 * ("Startup Industry") must not: printing the industry where the company name
 * belongs is worse than printing nothing.
 */
const { resolveProjectName } = require("@/lib/email");

const has = (label, value = "Acme") => ({ submissionData: { f1: value }, fieldLabels: { f1: label } });

describe("resolveProjectName — the labels it reads", () => {
  test.each([
    "Nom du projet",
    "Nom de la startup",
    "Nom de l'entreprise",
    "Nom de la société",
    "Nom de la structure",
    "Nom de l'organisation",
    "Raison sociale",
    "Project name",
    "Startup name",
    "Company",
    "Venture name",
    "Business",
    "Name of the project",
  ])('reads "%s"', (label) => {
    expect(resolveProjectName(has(label))).toBe("Acme");
  });

  test.each([
    "Startup Industry",
    "Secteur de l'entreprise",
    "Nom du fondateur",
    "Taille de l'équipe",
  ])('does not read "%s"', (label) => {
    expect(resolveProjectName(has(label))).toBe("");
  });

  test("a blank answer resolves to nothing, never to an empty gap in the email", () => {
    expect(resolveProjectName(has("Nom du projet", "   "))).toBe("");
  });

  test("missing inputs never throw", () => {
    expect(() => resolveProjectName({})).not.toThrow();
    expect(resolveProjectName({})).toBe("");
    expect(resolveProjectName({ submissionData: null, fieldLabels: null })).toBe("");
  });
});
