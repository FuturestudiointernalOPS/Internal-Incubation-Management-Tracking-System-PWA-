/**
 * PHASE 7 — D7 : les six droits d'animation « sur le papier » sont RETIRÉS.
 *
 * L'arbitrage D7 (docs/permissions/phase-1-decisions.md) a tranché : les six
 * capacités d'animation/facilitateur qui étaient ACCORDÉES mais dont le niveau
 * n'était JAMAIS consulté par une décision sont retirées du vocabulaire plutôt
 * que câblées. Un droit qu'aucune route n'applique est un droit faux.
 *
 * Ce test verrouille l'état résultant, sur trois axes :
 *   1. l'absence des six clés dans les trois déclarations (vocabulaire, modules,
 *      catalogue) et la présence exacte des sept droits consultés ;
 *   2. l'absence de tout usage de ces clés par une route (`capability: "…"`) ;
 *   3. l'auto-nettoyage : une ligne de tick-list HISTORIQUE qui porte encore une
 *      clé retirée n'est plus « désirée », donc le planificateur du réconciliateur
 *      la RÉVOQUE (aucun droit retiré ne survit « sur le papier »).
 *
 * Aucune base de données : toutes les fonctions exercées ici sont pures.
 */
const fs = require("node:fs");
const path = require("node:path");

const { FACILITATOR_CAPABILITY_KEYS } = require("@/lib/facilitator-permissions");
const { PERMISSION_MODULES } = require("@/server/authz/capabilities");
const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");
const {
  deriveFacilitatorDesiredCaps,
} = require("@/services/authorization/programAssignments");
const { planContextGrantChanges } = require("@/services/authorization/contextGrantPlan");

/** Les six droits accordés mais jamais consultés — RETIRÉS par D7. */
const RETIRED = [
  "participants.manage",
  "assignments.review",
  "sessions.record",
  "progress.view",
  "groups.view",
  "groups.manage",
];

/** Les sept droits réellement consultés — CONSERVÉS. */
const CONSULTED = [
  "participants.view",
  "attendance.view",
  "attendance.record",
  "assignments.view",
  "assignments.grade",
  "sessions.conduct",
  "reviews.submit",
];

const ROOT = path.join(__dirname, "..", "..");
const API_ROOT = path.join(ROOT, "src", "app", "api");

/** Every `capability: "<key>"` argument found in the API routes. */
function capabilityArgsInRoutes() {
  const found = new Set();
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name === "route.js") {
        const src = fs.readFileSync(fullPath, "utf8");
        for (const match of src.matchAll(/capability:\s*"([a-z_.]+)"/g)) found.add(match[1]);
      }
    }
  })(API_ROOT);
  return found;
}

describe("D7 — les six droits retirés sont absents de chaque déclaration", () => {
  test("absents de FACILITATOR_CAPABILITY_KEYS", () => {
    for (const key of RETIRED) {
      expect(FACILITATOR_CAPABILITY_KEYS).not.toContain(key);
    }
  });

  test("absents de PERMISSION_MODULES.facilitator", () => {
    for (const key of RETIRED) {
      expect(PERMISSION_MODULES.facilitator.capabilities).not.toContain(key);
    }
  });

  test("absents du catalogue de capacités", () => {
    for (const key of RETIRED) {
      expect(CAPABILITY_CATALOG.facilitator.capabilities).not.toHaveProperty(key);
    }
  });

  test("le vocabulaire restant est exactement les sept droits consultés", () => {
    expect([...FACILITATOR_CAPABILITY_KEYS].sort()).toEqual([...CONSULTED].sort());
  });

  test("aucune route ne consulte un droit retiré", () => {
    const used = capabilityArgsInRoutes();
    for (const key of RETIRED) {
      expect(used.has(key)).toBe(false);
    }
  });
});

describe("D7 — un octroi historique est révoqué, pas conservé sur le papier", () => {
  test("une tick-list qui porte encore un droit retiré ne le rend plus « désiré »", () => {
    const { desired } = deriveFacilitatorDesiredCaps([
      {
        program_id: "P1",
        role_key: "facilitator",
        profile_key: null,
        // Ligne HISTORIQUE : contient encore les clés retirées.
        permissions: JSON.stringify({ "groups.view": 2, "groups.manage": 2 }),
      },
    ]);

    // Les droits consultés restent (défaut « non configuré = accordé »)…
    expect(desired["facilitator.attendance.view"]).toBeDefined();
    // …mais les droits retirés ne sont plus dérivés du tout.
    expect(desired["facilitator.groups.view"]).toBeUndefined();
    expect(desired["facilitator.groups.manage"]).toBeUndefined();
  });

  test("le planificateur retire ce que le réconciliateur avait écrit pour un droit retiré", () => {
    const { desired } = deriveFacilitatorDesiredCaps([
      { program_id: "P1", role_key: "facilitator", profile_key: null, permissions: null },
    ]);
    const { toRevoke } = planContextGrantChanges({
      desired,
      existing: [],
      provenance: [
        { module: "facilitator", capability: "groups.view" },
        { module: "facilitator", capability: "attendance.view" },
      ],
      sentinel: "ctx:program:facilitator",
    });
    // `attendance.view` reste désiré → rien à révoquer pour lui.
    expect(toRevoke).toEqual([{ module: "facilitator", capability: "groups.view" }]);
  });
});
