/**
 * PHASE 5 — périmètre programme basé PROFIL (`program_managed`).
 *
 * Le lecteur ne retient que les affectations ACTIVES du profil `program_manager`
 * dans le contexte programme, période valide incluse (début inclus, fin exclue).
 */

const mockDb = { execute: jest.fn(async () => ({ rows: [] })) };
jest.mock("@/lib/db", () => ({ __esModule: true, default: mockDb }));

const { getProgramManagedScopeIds } = require("@/models/authorization/scopeReads");

const sqlOf = () => String(mockDb.execute.mock.calls[0][0].sql);

beforeEach(() => {
  mockDb.execute.mockReset();
  mockDb.execute.mockResolvedValue({ rows: [] });
});

test("ne retient que le profil program_manager, actif, dans le contexte programme", async () => {
  await getProgramManagedScopeIds("U1");
  const sql = sqlOf();
  expect(sql).toMatch(/FROM profile_assignments/i);
  expect(sql).toMatch(/context_type = 'program'/i);
  expect(sql).toMatch(/profile_key = 'program_manager'/i);
  expect(sql).toMatch(/status = 'active'/i);
});

test("vérifie la période (début inclus, fin exclue)", async () => {
  await getProgramManagedScopeIds("U1");
  const sql = sqlOf();
  expect(sql).toMatch(/started_at IS NULL OR started_at <= NOW\(\)/i);
  expect(sql).toMatch(/ends_at IS NULL OR ends_at > NOW\(\)/i);
});

test("renvoie les identifiants de programme en chaînes", async () => {
  mockDb.execute.mockResolvedValueOnce({ rows: [{ id: 42 }, { id: "P-9" }] });
  const ids = await getProgramManagedScopeIds("U1");
  expect(ids).toEqual(["42", "P-9"]);
  expect(mockDb.execute.mock.calls[0][0].args).toEqual(["U1"]);
});
