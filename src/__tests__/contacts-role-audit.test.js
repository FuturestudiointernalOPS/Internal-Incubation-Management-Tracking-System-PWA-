/**
 * SPEC §12.1 — un changement de rôle GLOBAL doit laisser une trace.
 *
 * Le chemin standard `PUT /api/contacts` écrivait `contacts.role` sans jamais
 * appeler `logPermissionAudit` : un rôle pouvait changer sans entrée dans
 * `permission_audit_log`, alors que le chemin du Permission Center l'audite
 * déjà. Ce test prouve que :
 *   - un vrai changement de rôle écrit une entrée `role_changed` (avant/après) ;
 *   - une écriture sans changement ne produit AUCUNE trace ;
 *   - une requête sans rôle, ou d'un appelant sans le droit d'attribuer un rôle,
 *     ne lit même pas le rôle précédent.
 */

const mockState = {
  priorRole: null,
  targetName: "Ada",
  denyAssign: false,
};

jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return actual;
});

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
  assertNoParticipantFacilitatorConflict: jest.fn(async () => null),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "ADMIN-1", name: "Admin", email: "admin@x.test" })),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async (module, capability) => {
    if (module === "permissions" && capability === "assign_capabilities" && mockState.denyAssign) {
      const { NextResponse } = require("next/server");
      return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 });
    }
    return null;
  }),
}));

jest.mock("@/models/authorization/membership", () => ({
  normalizeGroupName: (value) => String(value || "").trim().toUpperCase(),
  INTERNAL_GROUP: "FUTURE STUDIO",
}));

jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn(async () => true),
}));

jest.mock("@/models/contacts/contactStore", () => ({
  updateContactFields: jest.fn(async () => ({ rowsAffected: 1 })),
  getContactIdentityByCid: jest.fn(async () => ({
    rows: [{ name: mockState.targetName, email: "a@x.test", role: mockState.priorRole }],
  })),
  markAdminNotificationsRead: jest.fn(async () => true),
}));

jest.mock("@/models/contacts/programMembership", () => ({
  getProgramById: jest.fn(async () => ({ rows: [{ id: "P1" }] })),
  removeContactProgramsExcept: jest.fn(async () => ({})),
  clearContactPrograms: jest.fn(async () => ({})),
  addContactProgramMembership: jest.fn(async () => ({})),
  recordParticipantProgramAudit: jest.fn(async () => ({})),
  deleteContactPrograms: jest.fn(async () => ({})),
  ensureContactProgramMembership: jest.fn(async () => ({})),
}));

jest.mock("@/services/contacts/registryRead", () => ({ readRegistryContacts: jest.fn(async () => ({ contacts: [] })) }));
jest.mock("@/services/contacts/deletion", () => ({ softDeleteRegistryContact: jest.fn(async () => true) }));
jest.mock("@/services/contacts/registration", () => ({ registerContacts: jest.fn(async () => ({ inserted: 0, errors: [] })) }));

const { PUT } = require("@/app/api/contacts/route");
const { getContactIdentityByCid, updateContactFields } = require("@/models/contacts/contactStore");
const { logPermissionAudit } = require("@/models/authorization/accessQueries");

const put = (body) =>
  new Request("http://localhost/api/contacts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockState.priorRole = null;
  mockState.targetName = "Ada";
  mockState.denyAssign = false;
  getContactIdentityByCid.mockImplementation(async () => ({
    rows: [{ name: mockState.targetName, email: "a@x.test", role: mockState.priorRole }],
  }));
  updateContactFields.mockResolvedValue({ rowsAffected: 1 });
});

test("un vrai changement de rôle écrit une entrée role_changed (avant/après)", async () => {
  mockState.priorRole = "member";

  const res = await PUT(put({ cid: "C1", name: "Ada", role: "staff" }));

  expect(res.status).toBe(200);
  expect(logPermissionAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "role_changed",
      targetCid: "C1",
      previousValue: "member",
      newValue: "staff",
    }),
  );
});

test("une écriture sans changement réel ne produit aucune trace", async () => {
  mockState.priorRole = "staff";

  await PUT(put({ cid: "C1", name: "Ada", role: "staff" }));

  expect(logPermissionAudit).not.toHaveBeenCalled();
});

test("aucune entrée de rôle, aucune lecture du rôle précédent ni trace", async () => {
  await PUT(put({ cid: "C1", name: "Ada" }));

  expect(getContactIdentityByCid).not.toHaveBeenCalled();
  expect(logPermissionAudit).not.toHaveBeenCalled();
});

test("un appelant sans le droit d'attribuer un rôle n'écrit pas et n'audite pas", async () => {
  mockState.denyAssign = true;
  mockState.priorRole = "member";

  const res = await PUT(put({ cid: "C1", name: "Ada", role: "staff" }));

  expect(res.status).toBe(200);
  // Le rôle n'est pas dans la liste des colonnes modifiables → pas de trace.
  expect(getContactIdentityByCid).not.toHaveBeenCalled();
  expect(logPermissionAudit).not.toHaveBeenCalled();
});
