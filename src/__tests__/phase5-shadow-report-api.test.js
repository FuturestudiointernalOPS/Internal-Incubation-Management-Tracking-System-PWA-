/**
 * PHASE 5 (c3b) — surface de LECTURE des divergences du mode ombre.
 *
 * L'opérateur active `AUTHZ_SHADOW_MODE=1` en staging, puis lit ce rapport au
 * lieu de fouiller les journaux : total, agrégat par ressource:policy (avec la
 * DIRECTION du trou) et liste récente. Ce test verrouille la porte (view_matrix)
 * et le reset.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  initDb: jest.fn(async () => {}),
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));

jest.mock("@/lib/requestOrigin", () => ({
  requireSameOrigin: jest.fn(() => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const mockReport = {
  enabled: true,
  total: 3,
  byKey: { "program:program_assigned": { count: 3, legacyAllowEngineDeny: 3, legacyDenyEngineAllow: 0 } },
  recent: [],
};
const mockReset = jest.fn();
jest.mock("@/services/authorization/shadow", () => ({
  getShadowReport: jest.fn(() => mockReport),
  resetShadowReport: jest.fn(() => mockReset()),
}));

const { NextResponse } = require("next/server");
const { GET, DELETE } = require("@/app/api/engineering/permissions/shadow-report/route");
const { requireAuthorization } = require("@/models/authorization/index");
const { requireSameOrigin } = require("@/lib/requestOrigin");
const { resetShadowReport } = require("@/services/authorization/shadow");

const req = (method = "GET") =>
  new Request("http://localhost/api/engineering/permissions/shadow-report", { method });

beforeEach(() => {
  jest.clearAllMocks();
  requireAuthorization.mockResolvedValue(null);
  requireSameOrigin.mockReturnValue(null);
});

test("GET renvoie le rapport et exige view_matrix", async () => {
  const res = await GET(req());
  const body = await res.json();

  expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  expect(res.status).toBe(200);
  expect(body.success).toBe(true);
  expect(body.enabled).toBe(true);
  expect(body.total).toBe(3);
  expect(body.byKey["program:program_assigned"].legacyAllowEngineDeny).toBe(3);
});

test("GET est refusé quand la capacité manque", async () => {
  requireAuthorization.mockResolvedValueOnce(
    NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 }),
  );

  const res = await GET(req());
  expect(res.status).toBe(403);
});

test("GET est protégé same-origin (aucune lecture cross-site)", async () => {
  requireSameOrigin.mockReturnValueOnce(
    NextResponse.json({ success: false, error: "errors.sameOriginRequired" }, { status: 403 }),
  );

  const res = await GET(req());
  expect(res.status).toBe(403);
});

test("DELETE vide le tampon (nouvelle mesure)", async () => {
  const res = await DELETE(req("DELETE"));
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.success).toBe(true);
  expect(resetShadowReport).toHaveBeenCalledTimes(1);
});
