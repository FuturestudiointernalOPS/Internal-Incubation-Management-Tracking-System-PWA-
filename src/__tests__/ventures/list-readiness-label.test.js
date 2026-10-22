/** The venture list says WHY a venture has no readiness figure instead of a bare dash. */
import fs from "node:fs";

const en = require("@/locales/en/vadmin.json");
const fr = require("@/locales/fr/vadmin.json");

test("the undefined-readiness chip says 'No required documents', with an explanation", () => {
  expect(en.vadmin.list.readinessUndefined).toBe("No required documents");
  expect(fr.vadmin.list.readinessUndefined).toBe("Aucun document requis");
  for (const dict of [en, fr]) {
    expect(dict.vadmin.list.readinessUndefinedHint.length).toBeGreaterThan(40);
    expect(dict.vadmin.list.readinessHint.length).toBeGreaterThan(10);
  }
});

test("the list wires the explanation as a tooltip and never shows a bare dash", () => {
  const page = fs.readFileSync("src/app/admin/ventures/page.js", "utf8");
  expect(page).toContain('t("vadmin.list.readinessUndefinedHint")');
  expect(page).toContain("title={readiness.hint || t(\"vadmin.list.readinessHint\")}");
  expect(en.vadmin.list.readinessUndefined).not.toBe("—");
});
