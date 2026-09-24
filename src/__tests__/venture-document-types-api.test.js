/**
 * /api/ventures/[id]/document-types — who may define a Venture's Data bank
 * documents.
 *
 * The list belongs to the VENTURE, so the gate is scoped to the Venture in the
 * URL: a Super Admin, or a delegated staff member carrying the `lead_manager`
 * responsibility ON THAT Venture. The decision itself lives in the model and is
 * covered there; these tests pin that every route asks for it, that the read
 * tells the screen whether editing is allowed, and that a refusal never reaches
 * the write.
 */

const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  __esModule: true,
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn(),
}));

jest.mock("@/lib/ventureAuth", () => ({
  __esModule: true,
  requireVentureAccess: jest.fn(),
}));

jest.mock("@/lib/ventureOperatingPlans", () => ({
  __esModule: true,
  resolveVentureCode: jest.fn(async (_db, id) => id),
}));

jest.mock("@/models/ventureDocumentTypes", () => ({
  __esModule: true,
  canManageVentureDocumentTypes: jest.fn(),
  createVentureDocumentType: jest.fn(),
  deleteVentureDocumentType: jest.fn(),
  ensureVentureDocumentTypesForVenture: jest.fn().mockResolvedValue(undefined),
  listVentureDocumentTypes: jest.fn().mockResolvedValue([]),
  updateVentureDocumentType: jest.fn(),
}));

const { getSession } = require("@/lib/auth");
const { requireVentureAccess } = require("@/lib/ventureAuth");
const model = require("@/models/ventureDocumentTypes");
const {
  GET: listTypes,
  POST: createType,
} = require("@/app/api/ventures/[id]/document-types/route");
const {
  PATCH: updateType,
  DELETE: deleteType,
} = require("@/app/api/ventures/[id]/document-types/[typeId]/route");

const VENTURE = "VNT-1";
const ctx = { params: Promise.resolve({ id: VENTURE, typeId: "9" }) };
const url = `http://localhost/api/ventures/${VENTURE}/document-types`;

beforeEach(() => {
  jest.clearAllMocks();
  model.ensureVentureDocumentTypesForVenture.mockResolvedValue(undefined);
  model.listVentureDocumentTypes.mockResolvedValue([]);
  getSession.mockResolvedValue({ cid: "USR-1", role: "staff" });
  requireVentureAccess.mockResolvedValue({ ventureId: VENTURE, session: { cid: "USR-1", role: "staff" } });
});

describe("GET — the same door as the Venture itself", () => {
  test("a reader who may not see the Venture is refused before anything is read", async () => {
    requireVentureAccess.mockResolvedValue({ ventureId: VENTURE, session: null });

    const res = await listTypes(new Request(url), ctx);

    expect(res.status).toBe(404);
    expect(model.listVentureDocumentTypes).not.toHaveBeenCalled();
  });

  test("the read says whether the caller may edit, and flags built-in types", async () => {
    model.canManageVentureDocumentTypes.mockResolvedValue(false);
    model.listVentureDocumentTypes.mockResolvedValue([
      { id: 1, code: "legal_documents", label_en: "Legal Documents" },
      { id: 9, code: "tax_clearance", label_en: "Tax clearance" },
    ]);

    const res = await listTypes(new Request(url), ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.can_manage).toBe(false);
    expect(body.venture_id).toBe(VENTURE);
    expect(body.document_types.map((type) => type.is_builtin)).toEqual([true, false]);
    // A reader who may not edit is not shown retired types either.
    expect(model.listVentureDocumentTypes).toHaveBeenCalledWith({
      ventureId: VENTURE,
      includeInactive: false,
    });
  });

  test("a manager asking for retired types gets them", async () => {
    model.canManageVentureDocumentTypes.mockResolvedValue(true);

    await listTypes(new Request(`${url}?include_inactive=true`), ctx);

    expect(model.listVentureDocumentTypes).toHaveBeenCalledWith({
      ventureId: VENTURE,
      includeInactive: true,
    });
  });
});

describe("the write gate — scoped to the Venture", () => {
  test("that Venture's Lead Manager may define a type", async () => {
    model.canManageVentureDocumentTypes.mockResolvedValue(true);
    model.createVentureDocumentType.mockResolvedValue({ id: 12, code: "tax_clearance" });

    const res = await createType(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label_en: "Tax clearance" }),
      }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, id: 12, code: "tax_clearance" });
    expect(model.canManageVentureDocumentTypes.mock.calls[0][1]).toBe(VENTURE);
    expect(model.createVentureDocumentType.mock.calls[0][0].ventureId).toBe(VENTURE);
  });

  test("someone who does not lead that Venture is refused, and nothing is written", async () => {
    model.canManageVentureDocumentTypes.mockResolvedValue(false);

    const created = await createType(new Request(url, { method: "POST" }), ctx);
    const patched = await updateType(new Request(`${url}/9`, { method: "PATCH" }), ctx);
    const deleted = await deleteType(new Request(`${url}/9`, { method: "DELETE" }), ctx);

    expect([created.status, patched.status, deleted.status]).toEqual([403, 403, 403]);
    expect(model.createVentureDocumentType).not.toHaveBeenCalled();
    expect(model.updateVentureDocumentType).not.toHaveBeenCalled();
    expect(model.deleteVentureDocumentType).not.toHaveBeenCalled();
  });

  test("an update is addressed to the Venture in the URL, and its refusal is reported", async () => {
    model.canManageVentureDocumentTypes.mockResolvedValue(true);
    model.updateVentureDocumentType.mockResolvedValue({ success: true });

    const accepted = await updateType(
      new Request(`${url}/9`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      }),
      ctx,
    );
    expect(accepted.status).toBe(200);
    expect(model.updateVentureDocumentType.mock.calls[0][0]).toMatchObject({
      ventureId: VENTURE,
      id: "9",
    });

    model.updateVentureDocumentType.mockRejectedValue(
      new Error("venture.documentTypes.errorBuiltIn"),
    );
    const refused = await updateType(new Request(`${url}/9`, { method: "PATCH" }), ctx);

    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toBe("venture.documentTypes.errorBuiltIn");
  });
});
