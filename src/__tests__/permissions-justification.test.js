/**
 * PHASE 4 — sous-lot 2 : la JUSTIFICATION renvoyée par la décision
 * (spec §11 « justification vérifiable », §12.4 « pourquoi autorisé/refusé »).
 *
 * `explainAuthorization` renvoie `{ allowed, reason }` ; `authorize` délègue,
 * de sorte que le booléen et la raison ne peuvent pas diverger. La raison est un
 * enum (sans donnée sensible).
 */
const {
  authorize,
  explainAuthorization,
  AUTHZ_REASONS,
} = require("@/services/authorization/contextDecisions");

const ctx = (over = {}) => ({
  cid: "U1",
  role: "staff",
  isSuperAdmin: false,
  accountStatus: "active",
  eligibility: { crm: true },
  effective: { crm: { view: 2 } },
  grants: {},
  restrictions: {},
  ...over,
});

describe("explainAuthorization — la justification (spec §11 / §12.4)", () => {
  test("entrée invalide → invalid_input", () => {
    expect(explainAuthorization(null, "crm", "view").reason).toBe(AUTHZ_REASONS.INVALID_INPUT);
    expect(explainAuthorization(ctx(), "", "view").reason).toBe(AUTHZ_REASONS.INVALID_INPUT);
    expect(explainAuthorization(ctx(), "crm", "").reason).toBe(AUTHZ_REASONS.INVALID_INPUT);
  });

  test("super admin sans restriction → super_admin (autorisé)", () => {
    const d = explainAuthorization(
      ctx({ isSuperAdmin: true, eligibility: null, effective: {} }),
      "crm",
      "view",
    );
    expect(d).toMatchObject({ allowed: true, reason: AUTHZ_REASONS.SUPER_ADMIN });
  });

  test("compte non actif → account_not_active", () => {
    const d = explainAuthorization(ctx({ accountStatus: "suspended" }), "crm", "view");
    expect(d).toMatchObject({ allowed: false, reason: AUTHZ_REASONS.ACCOUNT_NOT_ACTIVE });
  });

  test("feature non éligible → not_eligible", () => {
    const d = explainAuthorization(ctx({ eligibility: { crm: false } }), "crm", "view");
    expect(d).toMatchObject({ allowed: false, reason: AUTHZ_REASONS.NOT_ELIGIBLE });
  });

  test("blocage explicite → blocked (et non missing_permission)", () => {
    const d = explainAuthorization(
      ctx({ restrictions: { crm: new Set(["view"]) }, effective: {} }),
      "crm",
      "view",
    );
    expect(d).toMatchObject({ allowed: false, reason: AUTHZ_REASONS.BLOCKED });
  });

  test("droit absent → missing_permission", () => {
    const d = explainAuthorization(ctx({ effective: {} }), "crm", "view");
    expect(d).toMatchObject({ allowed: false, reason: AUTHZ_REASONS.MISSING_PERMISSION });
  });

  test("niveau insuffisant → insufficient_level", () => {
    const d = explainAuthorization(ctx(), "crm", "view", 3);
    expect(d).toMatchObject({ allowed: false, reason: AUTHZ_REASONS.INSUFFICIENT_LEVEL });
  });

  test("accordé → granted", () => {
    expect(explainAuthorization(ctx(), "crm", "view")).toMatchObject({
      allowed: true,
      reason: AUTHZ_REASONS.GRANTED,
    });
  });

  test("super admin : octroi explicite sous le niveau → insufficient_level", () => {
    const d = explainAuthorization(
      ctx({ isSuperAdmin: true, grants: { crm: { view: 1 } } }),
      "crm",
      "view",
      3,
    );
    expect(d).toMatchObject({ allowed: false, reason: AUTHZ_REASONS.INSUFFICIENT_LEVEL });
  });

  test("super admin bloqué explicitement → blocked", () => {
    const d = explainAuthorization(
      ctx({ isSuperAdmin: true, restrictions: { crm: new Set(["view"]) } }),
      "crm",
      "view",
    );
    expect(d).toMatchObject({ allowed: false, reason: AUTHZ_REASONS.BLOCKED });
  });
});

describe("authorize délègue — le booléen et la raison ne divergent jamais", () => {
  const cases = [
    ctx(),
    ctx({ accountStatus: "suspended" }),
    ctx({ eligibility: { crm: false } }),
    ctx({ effective: {} }),
    ctx({ restrictions: { crm: new Set(["view"]) }, effective: {} }),
    ctx({ isSuperAdmin: true, eligibility: null, effective: {} }),
    ctx({ isSuperAdmin: true, grants: { crm: { view: 1 } } }),
  ];

  test.each(cases.map((c, i) => [i, c]))("cas %i : authorize == explainAuthorization().allowed", (_i, c) => {
    expect(authorize(c, "crm", "view", 2)).toBe(
      explainAuthorization(c, "crm", "view", 2).allowed,
    );
  });
});
