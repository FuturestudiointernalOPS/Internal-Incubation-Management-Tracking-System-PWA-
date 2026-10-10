/**
 * PHASE 7 — D6 : le profil dédié « gestionnaire de cours ».
 *
 * L'arbitrage D6 (docs/permissions/phase-1-decisions.md) a tranché l'option (i) :
 * la liste demandée — publier/dépublier, inscrire un apprenant, créer des
 * évaluations, révoquer un certificat, attacher des ressources — passe par le
 * **droit UNIQUE actuel de gestion des cours** (`lms.edit`), accordé via un
 * **profil dédié** que SEUL le staff désigné porte (jamais tout le staff). Il
 * couvre « un peu plus » (archivage, suppression d'évaluation, vignettes) — assumé.
 *
 * Le Super Admin le détient par défaut (bypass). Aucun profil semé ne détenait ce
 * droit avant ce lot : `docs/AUTHZ_CURRENT_STATE.md` §9 (seul le Super Admin).
 *
 * Ce test verrouille : le profil existe (staff only), il porte le droit unique, il
 * est assignable, et — la partie qui compte — **être staff ne suffit pas** : sans
 * le profil, `lms.edit` est refusé ; avec lui, il est accordé.
 *
 * Tout est pur (aucune base, aucun réseau).
 */
const {
  PROFILE_CATALOGUE_SEED,
} = require("@/models/authorization/profileCatalogueSeed");
const {
  PROFILE_CATALOG,
  isValidProfileKey,
  baselineRoleForProfile,
} = require("@/models/authorization/profile-catalog");
const {
  explainAuthorization,
} = require("@/services/authorization/contextDecisions");

const COURSE_MANAGER = "course_manager";

const seedEntry = PROFILE_CATALOGUE_SEED.find((def) => def.key === COURSE_MANAGER);

/** A staff context that is eligible for the learning feature. */
function staffContext({ effective = {}, baseCaps = {} } = {}) {
  return {
    isSuperAdmin: false,
    role: "staff",
    eligibility: { lms: true },
    restrictions: new Set(),
    grants: {},
    baseCaps,
    groupCaps: {},
    effective,
    accountStatus: "active",
  };
}

describe("D6 — le profil dédié existe et est réservé au staff", () => {
  test("le seed déclare `course_manager`, staff uniquement", () => {
    expect(seedEntry).toBeTruthy();
    expect(seedEntry.allowedRoles).toEqual(["staff"]);
    expect(seedEntry.context).toBe("staff");
  });

  test("il porte le droit UNIQUE de gestion des cours (lms.edit) + la lecture", () => {
    expect(seedEntry.capabilities.lms).toEqual({ view: 1, edit: 3 });
    expect(seedEntry.capabilities.lms.edit).toBeGreaterThanOrEqual(1);
  });

  test("il figure dans le catalogue de lecture et s'aligne sur le rôle staff", () => {
    expect(PROFILE_CATALOG.some((p) => p.key === COURSE_MANAGER)).toBe(true);
    expect(isValidProfileKey(COURSE_MANAGER)).toBe(true);
    expect(baselineRoleForProfile(COURSE_MANAGER)).toBe("staff");
  });
});

describe("D6 — porter le profil ouvre la gestion des cours, être staff ne suffit pas", () => {
  test("un staff SANS le profil ne peut pas gérer les cours", () => {
    expect(explainAuthorization(staffContext(), "lms", "edit").allowed).toBe(false);
  });

  test("un staff AVEC le profil (non-propriétaire) peut gérer les cours", () => {
    const ctx = staffContext({
      effective: { lms: { view: 1, edit: 3 } },
      baseCaps: { lms: { view: 1, edit: 3 } },
    });
    expect(explainAuthorization(ctx, "lms", "edit").allowed).toBe(true);
  });

  test("le Super Admin le détient par défaut (bypass)", () => {
    expect(explainAuthorization({ isSuperAdmin: true }, "lms", "edit").allowed).toBe(true);
  });
});
