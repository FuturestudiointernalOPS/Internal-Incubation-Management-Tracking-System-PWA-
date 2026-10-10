/**
 * PHASE 6 — la liste des actions ouvertes, consultable depuis l'administration.
 *
 * Vérifie l'API (garde + payload) et le contrat d'interface : l'onglet
 * « openActions » existe sous Rules et rend le composant de la liste.
 */

const fs = require("node:fs");
const path = require("node:path");

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));

const mockRequireAuthorization = jest.fn(async () => null);
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: (...args) => mockRequireAuthorization(...args),
}));

const { NextResponse } = require("next/server");
const { GET } = require("@/app/api/engineering/permissions/open-actions/route");
const {
  SELF_SCOPED_ROUTES,
  OPEN_ASSUMED_ROUTES,
} = require("@/services/authorization/actionDeclarations");
const { PROTOTYPE_TABS } = require("@/components/permissions/prototype/prototypeNav");

describe("API — GET /api/engineering/permissions/open-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuthorization.mockResolvedValue(null);
  });

  test("exige permissions.view_matrix", async () => {
    await GET();
    expect(mockRequireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("renvoie les deux familles de déclarations", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.selfScoped).toEqual(SELF_SCOPED_ROUTES);
    expect(body.openAssumed).toEqual(OPEN_ASSUMED_ROUTES);
    expect(body.selfScoped.length).toBeGreaterThan(0);
    expect(body.openAssumed.length).toBeGreaterThan(0);
  });

  test("refuse quand la capacité manque", async () => {
    mockRequireAuthorization.mockResolvedValueOnce(
      NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 }),
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });
});

describe("contrat d'interface — onglet « openActions » sous Rules", () => {
  const ROOT = path.resolve(__dirname, "..", "..");
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

  test("PROTOTYPE_TABS.rules contient openActions", () => {
    expect(PROTOTYPE_TABS.rules).toContain("openActions");
  });

  test("RulesSection rend le composant de la liste pour cet onglet", () => {
    const src = read("src/components/permissions/prototype/sections/RulesSection.js");
    expect(src).toContain("OpenActionsTab");
    expect(src).toContain('tab === "openActions"');
  });
});
