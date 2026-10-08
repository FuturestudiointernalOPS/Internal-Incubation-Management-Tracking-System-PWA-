/**
 * `is_readiness` decides whether a stored document enters the Investment
 * Readiness denominator. A Venture can hold documents it never intended to be
 * scored on (extra proof, Data-bank-only paperwork), and counting them would
 * silently cap the percentage for the rest of the programme.
 *
 * The column is also absent on rows written before it existed, and those rows
 * used to count — so absence has to keep meaning `true`, or every already
 * configured Venture would silently drop its criteria.
 */

const VENTURE = "VNT-1";

const row = (overrides) => ({
  venture_id: VENTURE,
  code: "business_registration",
  required: true,
  is_readiness: true,
  ...overrides,
});

/** Runs `listVentureDocumentReadiness` over a fixed pair of query answers. */
async function readinessFor(types, items) {
  jest.resetModules();
  jest.doMock("@/lib/db", () => ({
    __esModule: true,
    default: {
      execute: jest.fn(async ({ sql }) => {
        if (sql.includes("items.category")) return { rows: items };
        if (sql.includes("venture_document_types")) return { rows: types };
        return { rows: [] };
      }),
    },
  }));
  // Schema preparation resolves its own connection; it is not what this file
  // is about, and it is covered by venture-document-types.test.js.
  jest.doMock("@/models/ventureDocumentTypesStore", () => ({
    __esModule: true,
    ensureVentureDocumentTypesTable: jest.fn(async () => {}),
  }));
  const { listVentureDocumentReadiness } = require("@/models/ventureReadiness");
  const [result] = await listVentureDocumentReadiness([VENTURE]);
  return result;
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock("@/lib/db");
  jest.dontMock("@/models/ventureDocumentTypesStore");
});

describe("listVentureDocumentReadiness — is_readiness", () => {
  test("excludes a Data-bank-only document from the denominator", async () => {
    const result = await readinessFor(
      [row({ code: "a" }), row({ code: "storage_only", is_readiness: false })],
      [{ venture_id: VENTURE, category: "a", status: "verified" }],
    );

    // Two configured types, but only one is scored — the extra one must not
    // halve the score.
    expect(result.total_required).toBe(1);
    expect(result.readiness_percent).toBe(100);
    expect(result.verified_count).toBe(1);
  });

  test("keeps scoring a document whose is_readiness is missing (pre-column row)", async () => {
    const result = await readinessFor(
      [
        { venture_id: VENTURE, code: "a", required: true },
        { venture_id: VENTURE, code: "b", required: true },
      ],
      [
        { venture_id: VENTURE, category: "a", status: "verified" },
        { venture_id: VENTURE, category: "b", status: "verified" },
      ],
    );

    expect(result.total_required).toBe(2);
    expect(result.readiness_percent).toBe(100);
  });

  test("still drops a document that is not required, readiness flag or not", async () => {
    const result = await readinessFor(
      [row({ code: "a" }), row({ code: "optional", required: false, is_readiness: false })],
      [{ venture_id: VENTURE, category: "a", status: "verified" }],
    );

    expect(result.total_required).toBe(1);
  });

  test("reports no score when every document is Data-bank-only", async () => {
    const result = await readinessFor(
      [row({ code: "storage_only", is_readiness: false })],
      [{ venture_id: VENTURE, category: "storage_only", status: "verified" }],
    );

    // Denominator of zero must be `null`, not a division by zero or a 0% that
    // reads like a Venture that failed every criterion.
    expect(result.total_required).toBe(0);
    expect(result.readiness_percent).toBeNull();
    expect(result.is_ready).toBe(false);
  });
});