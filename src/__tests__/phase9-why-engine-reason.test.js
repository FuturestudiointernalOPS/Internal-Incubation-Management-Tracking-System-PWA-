/**
 * PHASE 9 (§12.4) — « pourquoi autorisé / refusé » : la RAISON DU MOTEUR.
 *
 * L'écran Personnes ne doit pas re-dériver la raison : il affiche celle que le
 * moteur a réellement appliquée, refus compris. Cette projection
 * (`projectUserContext`) expose donc, pour chaque capacité du catalogue, la
 * décision d'`explainAuthorization` elle-même — le même calcul que les gardes de
 * route. Ces tests prouvent que la projection ne peut pas diverger du moteur.
 */

const { projectUserContext } = require("@/services/authorization/userContextProjection");
const { explainAuthorization } = require("@/services/authorization/contextDecisions");
const { PERMISSION_MODULES } = require("@/server/authz/capabilities");

const baseContext = () => ({
  isSuperAdmin: false,
  role: "staff",
  // Only CRM is open: every other feature is NOT eligible (fail-closed).
  eligibility: { crm: true },
  restrictions: new Set(),
  grants: {},
  baseCaps: { crm: { view: 2 } },
  groupCaps: {},
  effective: { crm: { view: 2 } },
  accountStatus: "active",
  profile: { id: 3, name: "Staff Default" },
  groups: ["TEAM A"],
});

const project = (context = baseContext()) =>
  projectUserContext("C1", context, { contexts: [], unavailable: [] });

test("chaque capacité porte la décision ET la raison du moteur", () => {
  const context = baseContext();
  const payload = project(context);

  for (const [module, definition] of Object.entries(PERMISSION_MODULES)) {
    for (const capability of definition.capabilities) {
      const expected = explainAuthorization(context, module, capability, 1);
      expect(payload.decisions[module][capability]).toEqual({
        allowed: expected.allowed,
        reason: expected.reason,
      });
    }
  }
});

test("un droit détenu est « granted »", () => {
  const payload = project();
  expect(payload.decisions.crm.view).toEqual({ allowed: true, reason: "granted" });
});

test("un refus porte la RAISON du moteur (non éligible), pas un libellé dérivé", () => {
  const payload = project();
  const financeCap = PERMISSION_MODULES.finance.capabilities[0];
  expect(payload.decisions.finance[financeCap]).toEqual({
    allowed: false,
    reason: "not_eligible",
  });
});

test("un compte inactif refuse AVANT l'éligibilité (§11), raison dédiée", () => {
  const context = baseContext();
  context.accountStatus = "suspended";
  const payload = project(context);

  const crmCap = PERMISSION_MODULES.crm.capabilities[0];
  expect(payload.decisions.crm[crmCap]).toEqual({
    allowed: false,
    reason: "account_not_active",
  });
});
