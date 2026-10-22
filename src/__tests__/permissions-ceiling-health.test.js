/**
 * PHASE 4 — sous-lot 3 : détecteur « plafond ouvert sans droit » (§12.3).
 *
 * L'inverse du validateur d'attribution : là où
 * `validateCapabilitiesWithinEligibility` attrape un DROIT sur un plafond FERMÉ,
 * `findOpenCeilingsWithoutRights` attrape un PLAFOND ouvert qui n'accorde aucun
 * droit. Pur — aucune base.
 */
const {
  findOpenCeilingsWithoutRights,
} = require("@/services/authorization/eligibilityAdmin");

describe("findOpenCeilingsWithoutRights (§12.3)", () => {
  test("un plafond ouvert sans droit est signalé", () => {
    const findings = findOpenCeilingsWithoutRights({
      eligibility: { operations: true },
      capabilities: {}, // aucun droit operations/projects/tasks
    });
    expect(findings).toEqual([{ feature: "operations", modules: ["projects", "tasks"] }]);
  });

  test("un plafond ouvert AVEC un droit n'est pas signalé", () => {
    const findings = findOpenCeilingsWithoutRights({
      eligibility: { operations: true },
      capabilities: { projects: { view: 1 } },
    });
    expect(findings).toEqual([]);
  });

  test("un droit de niveau 0 ne compte pas comme un droit", () => {
    const findings = findOpenCeilingsWithoutRights({
      eligibility: { operations: true },
      capabilities: { projects: { view: 0 }, tasks: { view: 0 } },
    });
    expect(findings).toEqual([{ feature: "operations", modules: ["projects", "tasks"] }]);
  });

  test("un plafond FERMÉ n'est jamais signalé", () => {
    const findings = findOpenCeilingsWithoutRights({
      eligibility: { operations: false, crm: false },
      capabilities: {},
    });
    expect(findings).toEqual([]);
  });

  test("entrée vide → aucun constat", () => {
    expect(findOpenCeilingsWithoutRights()).toEqual([]);
    expect(findOpenCeilingsWithoutRights({})).toEqual([]);
  });
});
