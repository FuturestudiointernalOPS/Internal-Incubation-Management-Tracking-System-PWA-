/**
 * PHASE 7 — D2 : fin de responsabilité / compte désactivé (spec §10.4, §16.4, §11).
 *
 * Décision D2 (arbitrage, option a) : si une personne voit son COMPTE désactivé
 * (elle quitte le staff), elle perd ces droits — **y compris la vue historique**.
 * L'historique est **CONSERVÉ** (les enregistrements restent), mais **sans accès**.
 *
 * La porte du compte (Phase 4, sous-lot 1) refuse un compte non « active » AVANT
 * l'éligibilité et la capacité. Ce test rend ce comportement EXPLICITE pour la
 * LECTURE RÉSIDUELLE (ce qu'un ancien gestionnaire consulte après la fin de sa
 * mission) : le résidu (`programs.view`) ne suffit pas à rouvrir l'accès.
 *
 * Décision pure : aucun accès base, aucun compte réel.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

const {
  authorize,
  explainAuthorization,
} = require("@/services/authorization/contextDecisions");

/** A context that HOLDS the residual read (an ended relationship's `programs.view`). */
const withResidual = (over = {}) => ({
  cid: "U1",
  role: "staff",
  isSuperAdmin: false,
  accountStatus: "active",
  eligibility: { programs: true },
  effective: { programs: { view: 1 } }, // the residual consultation ceiling
  grants: {},
  restrictions: {},
  ...over,
});

describe("D2 — la porte du compte ferme la lecture historique", () => {
  test("compte actif : la lecture résiduelle est autorisée", () => {
    expect(authorize(withResidual(), "programs", "view")).toBe(true);
  });

  test.each(["inactive", "pending", "archived", "suspended"])(
    "compte %s : la lecture résiduelle est refusée",
    (status) => {
      expect(authorize(withResidual({ accountStatus: status }), "programs", "view")).toBe(false);
    },
  );

  test("la raison est « account_not_active » — l'historique n'est pas supprimé, il est fermé", () => {
    const verdict = explainAuthorization(
      withResidual({ accountStatus: "suspended" }),
      "programs",
      "view",
    );
    expect(verdict).toEqual({ allowed: false, reason: "account_not_active", minLevel: 1 });
  });

  test("le refus précède l'éligibilité ET la capacité (la porte du compte est la 1re question)", () => {
    // Eligible AND holding the level — the account gate alone refuses.
    const ctx = withResidual({
      accountStatus: "suspended",
      eligibility: { programs: true },
      effective: { programs: { view: 3 } },
    });
    expect(authorize(ctx, "programs", "view")).toBe(false);
  });
});
