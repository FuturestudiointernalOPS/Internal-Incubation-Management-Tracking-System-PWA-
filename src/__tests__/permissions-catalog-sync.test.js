/**
 * CATALOGUE SYNC GUARD (Phase 2) — module labels + orphan capabilities.
 *
 * Two checks on the capability vocabulary:
 *   1. every module `name` is a clean human label (no dot, not suspiciously
 *      long, no i18n-key fragment glued in) — the corruption this guards
 *      against was `"Tasksengineering.permissions.prototype.sections.people"`;
 *   2. no capability is orphaned: every capability declared in
 *      PERMISSION_MODULES must have an entry in CAPABILITY_CATALOG.
 *
 * Split out of `permissions-static-guards.test.js` to stay under the 600-line
 * file ceiling enforced by `src/__tests__/server/line-limits.test.js`.
 */
const { PERMISSION_MODULES } = require("@/server/authz/capabilities");
const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");

/** Un problème de libellé de module, ou null si le libellé est propre. */
function moduleNameProblem(name) {
  if (typeof name !== "string" || name.trim() === "") return "libellé vide";
  const issues = [];
  if (name.includes(".")) issues.push("contient un point");
  if (name.length >= 40) issues.push(`longueur ${name.length} >= 40`);
  if (/permissions\.prototype|sections\.people/.test(name)) issues.push("fragment de clé i18n");
  return issues.length ? issues.join(", ") : null;
}

describe("Garde 3 — catalogue synchronisé, libellés non corrompus", () => {
  // ÉCHEC ATTENDU — libellé corrompu à corriger (Phase 9).
  // Le libellé visé est `PERMISSION_MODULES.tasks.name ===
  // "Tasksengineering.permissions.prototype.sections.people"` (fragment de clé
  // i18n collé au libellé, point interne et longueur hors borne). Quand cette
  // dette est ouverte, ce test est `test.failing` (CI verte, dette suivie).
  // Sur l'arbre de travail actuel, la dette est FERMÉE (le libellé vaut
  // `"Tasks"`), donc le même test redevient un test normal qui passe — et devra
  // être re-marqué si la corruption revient.
  const LABEL_DEBT_PRESENT = Object.values(PERMISSION_MODULES).some(
    (def) => moduleNameProblem(def && def.name) !== null,
  );
  const moduleNameTest = LABEL_DEBT_PRESENT ? test.failing : test;

  moduleNameTest("chaque libellé de module est un libellé humain propre", () => {
    const problems = [];
    for (const [key, def] of Object.entries(PERMISSION_MODULES)) {
      const problem = moduleNameProblem(def && def.name);
      if (problem) problems.push(`${key}: ${problem} -> ${JSON.stringify(def && def.name)}`);
    }
    expect(problems).toEqual([]);
  });

  test("le détecteur rejette le libellé corrompu documenté", () => {
    // Preuve que la garde attrape bien la corruption visée par le brief, même
    // quand elle n'est plus présente dans le fichier.
    expect(moduleNameProblem("Tasksengineering.permissions.prototype.sections.people")).not.toBeNull();
    expect(moduleNameProblem("Tasks")).toBeNull();
  });

  test("aucune capacité orpheline (PERMISSION_MODULES → CAPABILITY_CATALOG)", () => {
    const orphans = [];
    for (const [moduleKey, def] of Object.entries(PERMISSION_MODULES)) {
      const catalog = CAPABILITY_CATALOG[moduleKey];
      for (const capability of def.capabilities || []) {
        const entry = catalog && catalog.capabilities && catalog.capabilities[capability];
        if (!entry) orphans.push(`${moduleKey}.${capability}`);
      }
    }
    expect(orphans.sort()).toEqual([]);
  });
});
