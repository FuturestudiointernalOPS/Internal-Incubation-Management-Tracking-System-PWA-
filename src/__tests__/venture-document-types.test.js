/**
 * DATA BANK DOCUMENT TYPES — the definition layer, PER VENTURE.
 *
 * The documents a Venture is asked for used to be six hardcoded categories
 * copied into every screen. They are now a list that belongs to the VENTURE:
 * a Super Admin, or that Venture's Lead Manager, defines it. These tests pin the
 * rules that make that safe:
 *
 *   1. a Venture starts with the six built-in types, and an edited list is NEVER
 *      re-seeded — a list that was emptied by turning types off stays emptied;
 *   2. a built-in type, or one this Venture already filed documents against,
 *      cannot be deleted (turning it off is the way out);
 *   3. every read and write is scoped to its Venture, so one Venture's list can
 *      never be read or changed through another's;
 *   4. the write gate is Super Admin, or the `lead_manager` responsibility ON
 *      that Venture — never the role string alone;
 *   5. codes are derived once and kept unique within the Venture.
 */

const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn().mockResolvedValue(true),
}));

const {
  buildUniqueDocumentTypeCode,
  canManageVentureDocumentTypes,
  deleteVentureDocumentType,
  ensureVentureDocumentTypesForVenture,
  ensureVentureDocumentTypesTable,
  listActiveVentureDocumentTypesOrDefaults,
  listVentureDocumentTypes,
} = require("@/models/ventureDocumentTypes");
const {
  BUILT_IN_DOCUMENT_TYPE_CODES,
  DEFAULT_VENTURE_DOCUMENT_TYPES,
} = require("@/lib/ventureDocumentTypeDefaults");

const VENTURE = "VNT-1";

beforeEach(() => {
  jest.clearAllMocks();
});

/** A database double whose table starts empty (or answers via `handler`). */
const dbWithRows = (handler) => ({ execute: jest.fn(handler ?? (async () => ({ rows: [] }))) });

describe("ensureVentureDocumentTypesTable", () => {
  test("creates the table and its index, once per database", async () => {
    const statements = [];
    const db = dbWithRows(async ({ sql }) => {
      statements.push(sql);
      return { rows: [] };
    });

    await ensureVentureDocumentTypesTable(db);
    await ensureVentureDocumentTypesTable(db);

    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(statements[0]).toContain("CREATE TABLE IF NOT EXISTS venture_document_types");
    expect(statements[0]).toContain("UNIQUE(venture_id, code)");
    expect(statements[0]).toContain("REFERENCES ventures(venture_id)");
    expect(statements[1]).toContain("INDEX IF NOT EXISTS idx_venture_document_types_venture");
  });
});

describe("ensureVentureDocumentTypesForVenture", () => {
  test("seeds the six built-in types for a Venture that has none", async () => {
    const statements = [];
    const db = dbWithRows(async ({ sql }) => {
      statements.push(sql);
      if (sql.includes("COUNT(*)")) return { rows: [{ n: 0 }] };
      return { rows: [] };
    });

    await ensureVentureDocumentTypesForVenture(VENTURE, db);

    const insert = statements.find((sql) => sql.includes("INSERT INTO venture_document_types"));
    expect(insert).toBeTruthy();
    expect(insert.match(/\(\?, \?, \?, \?, \?, \?, \?, TRUE\)/g)).toHaveLength(
      DEFAULT_VENTURE_DOCUMENT_TYPES.length,
    );
    // Every row is written AGAINST the Venture, so the seed is per Venture.
    expect(insert).toContain("(venture_id, code, label_en");
    expect(BUILT_IN_DOCUMENT_TYPE_CODES).toEqual([
      "business_registration",
      "founder_identity",
      "email_verification",
      "phone_verification",
      "legal_documents",
      "financial_documents",
    ]);
  });

  test("never re-seeds a Venture that already has a list", async () => {
    const statements = [];
    const db = dbWithRows(async ({ sql }) => {
      statements.push(sql);
      if (sql.includes("COUNT(*)")) return { rows: [{ n: 6 }] };
      return { rows: [] };
    });

    await ensureVentureDocumentTypesForVenture(VENTURE, db);

    expect(statements.some((sql) => sql.includes("INSERT INTO venture_document_types"))).toBe(false);
  });

  test("asks per Venture", async () => {
    const db = dbWithRows(async ({ sql }) => {
      if (sql.includes("COUNT(*)")) return { rows: [{ n: 6 }] };
      return { rows: [] };
    });

    await ensureVentureDocumentTypesForVenture(VENTURE, db);

    const count = db.execute.mock.calls.find((call) => call[0].sql.includes("COUNT(*)"));
    expect(count[0].args).toEqual([VENTURE]);
  });
});

describe("listVentureDocumentTypes", () => {
  test("reads ONE Venture, active only unless inactive ones are wanted, in display order", async () => {
    const db = dbWithRows();

    await listVentureDocumentTypes({ ventureId: VENTURE, database: db });
    expect(db.execute.mock.calls[0][0].args).toEqual([VENTURE, 0]);
    expect(db.execute.mock.calls[0][0].sql).toContain("ORDER BY sort_order ASC, id ASC");

    await listVentureDocumentTypes({ ventureId: VENTURE, includeInactive: true, database: db });
    expect(db.execute.mock.calls[1][0].args).toEqual([VENTURE, 1]);
  });

  test("no Venture, no read", async () => {
    const db = dbWithRows();

    await expect(listVentureDocumentTypes({ database: db })).resolves.toEqual([]);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe("listActiveVentureDocumentTypesOrDefaults", () => {
  test("falls back to the built-in six when the list cannot be read", async () => {
    const db = dbWithRows(async () => {
      throw new Error("relation \"venture_document_types\" does not exist");
    });

    const rows = await listActiveVentureDocumentTypesOrDefaults(VENTURE, db);

    expect(rows.map((row) => row.code)).toEqual(BUILT_IN_DOCUMENT_TYPE_CODES);
    expect(rows.every((row) => row.is_active)).toBe(true);
  });
});

describe("deleteVentureDocumentType", () => {
  test("a type that is not this Venture's is a no-op", async () => {
    const db = dbWithRows(async () => ({ rows: [] }));

    await expect(deleteVentureDocumentType({ ventureId: VENTURE, id: 3 }, db)).resolves.toEqual({
      success: true,
    });
    expect(db.execute.mock.calls[0][0].args).toEqual([3, VENTURE]);
  });

  test("refuses to delete a built-in type", async () => {
    const db = dbWithRows(async () => ({ rows: [{ code: "legal_documents" }] }));

    await expect(deleteVentureDocumentType({ ventureId: VENTURE, id: 3 }, db)).rejects.toThrow(
      "venture.documentTypes.errorBuiltIn",
    );
  });

  test("refuses to delete a type this Venture filed documents against", async () => {
    const db = dbWithRows(async ({ sql }) => {
      if (sql.includes("SELECT id, code")) return { rows: [{ code: "tax_clearance" }] };
      if (sql.includes("COUNT(*)")) return { rows: [{ n: 2 }] };
      return { rows: [] };
    });

    await expect(deleteVentureDocumentType({ ventureId: VENTURE, id: 9 }, db)).rejects.toThrow(
      "venture.documentTypes.errorHasDocuments",
    );
    // The count is scoped to the Venture: another Venture's filed documents
    // must not block this one.
    const count = db.execute.mock.calls.find((call) => call[0].sql.includes("COUNT(*)"));
    expect(count[0].args).toEqual([VENTURE, "tax_clearance"]);
  });

  test("deletes a custom type nobody used, within its Venture", async () => {
    const db = dbWithRows(async ({ sql }) => {
      if (sql.includes("SELECT id, code")) return { rows: [{ code: "tax_clearance" }] };
      if (sql.includes("COUNT(*)")) return { rows: [{ n: 0 }] };
      return { rows: [] };
    });

    await deleteVentureDocumentType({ ventureId: VENTURE, id: 9 }, db);

    const deletion = db.execute.mock.calls.find((call) => call[0].sql.includes("DELETE FROM"));
    expect(deletion[0].args).toEqual([9, VENTURE]);
  });
});

describe("canManageVentureDocumentTypes — Super Admin, or THAT Venture's Lead Manager", () => {
  test("a Super Admin is allowed without asking the database", async () => {
    const db = dbWithRows();

    await expect(canManageVentureDocumentTypes({ role: "super_admin" }, VENTURE, db)).resolves.toBe(
      true,
    );
    expect(db.execute).not.toHaveBeenCalled();
  });

  test("a staff member who LEADS this Venture is allowed", async () => {
    const db = dbWithRows(async () => ({ rows: [{ 1: 1 }] }));

    await expect(
      canManageVentureDocumentTypes({ role: "staff", cid: "USR-1" }, VENTURE, db),
    ).resolves.toBe(true);
    const { sql, args } = db.execute.mock.calls[0][0];
    expect(sql).toContain("responsibility_code = 'lead_manager'");
    expect(sql).toContain("status = 'active'");
    expect(args).toEqual([VENTURE, "USR-1"]);
  });

  test("a staff member who does not lead it is refused, and without a Venture too", async () => {
    const db = dbWithRows();

    await expect(
      canManageVentureDocumentTypes({ role: "staff", cid: "USR-2" }, VENTURE, db),
    ).resolves.toBe(false);
    await expect(
      canManageVentureDocumentTypes({ role: "staff", cid: "USR-2" }, null, db),
    ).resolves.toBe(false);
    await expect(canManageVentureDocumentTypes(null, VENTURE, db)).resolves.toBe(false);
  });
});

describe("buildUniqueDocumentTypeCode", () => {
  test("derives the code from the label", async () => {
    const db = dbWithRows();

    await expect(
      buildUniqueDocumentTypeCode(VENTURE, "Tax clearance certificate", db),
    ).resolves.toBe("tax_clearance_certificate");
  });

  test("suffixes a code already taken WITHIN the Venture", async () => {
    const db = dbWithRows(async ({ sql, args }) =>
      sql.includes("SELECT id FROM venture_document_types") && args[1] === "legal_documents"
        ? { rows: [{ id: 1 }] }
        : { rows: [] },
    );

    await expect(buildUniqueDocumentTypeCode(VENTURE, "Legal Documents", db)).resolves.toBe(
      "legal_documents_2",
    );
  });
});
