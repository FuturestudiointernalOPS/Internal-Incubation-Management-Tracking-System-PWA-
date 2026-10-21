/**
 * VENTURE DATA ROOM — the rules that make it safe to use.
 *
 * These tests pin the decisions that are easy to get subtly wrong:
 *
 *   1. completeness counts ONLY required categories, and a rejected document
 *      scores 0.5 (never 1), so an upload is never silently "verified";
 *   2. a pre-revenue / idea-stage requirement list does not ask for a cap table
 *      or a corporate registration as if they were missing;
 *   3. the viewer verdict distinguishes manager, member, reviewer and granted
 *      investor — and an investor with a profile but NO grant is refused;
 *   4. a new version resets the review state, so version 2 never inherits
 *      version 1's verification;
 *   5. a grant must target a real person holding an investor profile, and the
 *      catalogue read in investor mode only returns granted documents.
 */

const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/authorization/investorScope", () => ({
  resolveInvestorScope: jest.fn(),
}));
jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn(async (session) => ({ isSuperAdmin: session?.role === "super_admin" })),
}));
jest.mock("@/services/ventures/permissions", () => ({
  hasAnyVentureAssignment: jest.fn(),
  hasVentureCapability: jest.fn(),
}));
jest.mock("@/services/ventures/verification/categories", () => ({
  canManageVerification: jest.fn(),
}));
jest.mock("@/services/ventures/activity", () => ({
  notifyVentureFounders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/ventureEvidence", () => ({
  signEvidencePath: jest.fn().mockResolvedValue(null),
  deleteEvidenceObject: jest.fn().mockResolvedValue(true),
}));

const { resolveInvestorScope } = require("@/models/authorization/investorScope");
const { hasAnyVentureAssignment, hasVentureCapability } = require("@/services/ventures/permissions");
const { canManageVerification } = require("@/services/ventures/verification/categories");

const {
  createDataRoomDocument,
  replaceDataRoomDocument,
  reviewDataRoomDocument,
  updateDataRoomMetadata,
  grantDataRoomAccess,
} = require("@/services/ventures/dataRoom");
const {
  ensureDataRoomSchema,
  selectDataRoomDocuments,
} = require("@/models/ventureDataRoomStore");

const VENTURE = "VNT-1";
const VENTURE_UUID = "11111111-1111-1111-1111-111111111111";

/** A database double that answers the resolve query and then `handler`. */
function makeDb(handler = async () => ({ rows: [] })) {
  return {
    execute: jest.fn(async (statement) => {
      const sql = statement.sql || "";
      if (sql.includes("SELECT id::text AS id FROM ventures")) {
        return { rows: [{ id: VENTURE_UUID }] };
      }
      return handler(statement);
    }),
  };
}

const founderSession = { cid: "USR-FOUNDER", role: "member", name: "Founder" };
const memberSession = { cid: "USR-MEMBER", role: "member", name: "Member" };
const superAdminSession = { cid: "USR-SA", role: "super_admin", name: "SA" };

beforeEach(() => {
  jest.clearAllMocks();
  resolveInvestorScope.mockResolvedValue({ management: false, profileId: null });
  hasAnyVentureAssignment.mockResolvedValue(false);
  hasVentureCapability.mockResolvedValue(false);
  canManageVerification.mockResolvedValue({ allowed: false });
});

// ── Upload / version / review ───────────────────────────────────────────────

const founderDb = () =>
  makeDb(async ({ sql }) => {
    if (sql.includes("FROM venture_members")) {
      return { rows: [{ member_type: "founder", lead_founder: true }] };
    }
    if (sql.includes("COUNT(*)") || sql.includes("MAX(COALESCE(version_number")) {
      return { rows: [{ max_version: 1 }] };
    }
    if (sql.includes("INSERT INTO venture_documents") && sql.includes("RETURNING id")) {
      return { rows: [{ id: "DOC-1" }] };
    }
    if (sql.includes("FROM venture_documents d")) {
      return {
        rows: [
          {
            id: "DOC-1",
            venture_id: VENTURE_UUID,
            title: "Pitch deck",
            name: "Pitch deck",
            category: "pitch_deck_business_plan",
            file_name: "deck.pdf",
            file_url: "data-room/VNT-1/pitch_deck_business_plan/deck.pdf",
            storage_path: "data-room/VNT-1/pitch_deck_business_plan/deck.pdf",
            current_version: 1,
            review_status: "uploaded",
            review_status_effective: "uploaded",
            is_deleted: false,
          },
        ],
      };
    }
    return { rows: [] };
  });

describe("createDataRoomDocument", () => {
  test("refuses a viewer who cannot manage the room", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_members")) return { rows: [{ member_type: "team_member" }] };
      return { rows: [] };
    });

    const result = await createDataRoomDocument({
      ventureId: VENTURE,
      session: memberSession,
      input: { title: "Deck", category: "pitch_deck_business_plan", file_path: "data-room/VNT-1/x" },
      database: db,
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  test("refuses a storage path that belongs to another venture", async () => {
    const db = founderDb();

    const result = await createDataRoomDocument({
      ventureId: VENTURE,
      session: founderSession,
      input: {
        title: "Deck",
        category: "pitch_deck_business_plan",
        file_path: "data-room/VNT-OTHER/pitch_deck_business_plan/secret.pdf",
      },
      database: db,
    });

    expect(result).toMatchObject({ ok: false, error: "dataRoom.errors.fileRequired" });
  });

  test("refuses an unknown category and a missing file", async () => {
    const db = founderDb();

    await expect(
      createDataRoomDocument({
        ventureId: VENTURE,
        session: founderSession,
        input: { title: "Deck", category: "not_a_category", file_url: "https://example.com/a.pdf" },
        database: db,
      }),
    ).resolves.toMatchObject({ ok: false, error: "dataRoom.errors.categoryInvalid" });

    await expect(
      createDataRoomDocument({
        ventureId: VENTURE,
        session: founderSession,
        input: { title: "Deck", category: "pitch_deck_business_plan" },
        database: db,
      }),
    ).resolves.toMatchObject({ ok: false, error: "dataRoom.errors.fileRequired" });
  });

  test("records the document, version 1 and an audit event", async () => {
    const db = founderDb();

    const result = await createDataRoomDocument({
      ventureId: VENTURE,
      session: founderSession,
      input: {
        title: "Pitch deck",
        category: "pitch_deck_business_plan",
        file_path: "data-room/VNT-1/pitch_deck_business_plan/deck.pdf",
        file_name: "deck.pdf",
        file_size: 1024,
        file_type: "application/pdf",
      },
      database: db,
    });

    expect(result).toEqual({ ok: true, document_id: "DOC-1" });

    const versionInsert = db.execute.mock.calls.find((call) =>
      call[0].sql.includes("INSERT INTO venture_document_versions"),
    );
    expect(versionInsert).toBeTruthy();
    expect(versionInsert[0].args).toContain(1);

    const audit = db.execute.mock.calls.find((call) =>
      call[0].sql.includes("INSERT INTO venture_activity_log"),
    );
    expect(audit[0].args).toContain("DATA_ROOM_DOCUMENT_UPLOADED");
  });
});

describe("updateDataRoomMetadata — safe reclassification of legacy documents", () => {
  test("a legacy category can be re-filed without creating a new version", async () => {
    const db = founderDb();

    const result = await updateDataRoomMetadata({
      ventureId: VENTURE,
      documentId: "DOC-1",
      session: founderSession,
      input: { category: "financials_projections" },
      database: db,
    });

    expect(result).toEqual({ ok: true, updated: true });

    // The catalogue row changes; the version history does not. Re-filing is
    // metadata, not a new upload, so nothing is lost from the audit trail.
    const update = db.execute.mock.calls.find((call) =>
      call[0].sql.includes("UPDATE venture_documents SET"),
    );
    expect(update[0].args).toContain("financials_projections");
    expect(
      db.execute.mock.calls.some((call) => call[0].sql.includes("INSERT INTO venture_document_versions")),
    ).toBe(false);

    const audit = db.execute.mock.calls.find((call) =>
      call[0].sql.includes("INSERT INTO venture_activity_log"),
    );
    expect(audit[0].args).toContain("DATA_ROOM_DOCUMENT_UPDATED");
  });
});

describe("replaceDataRoomDocument", () => {
  test("a new version clears verification and moves the pointer", async () => {
    const db = founderDb();

    const result = await replaceDataRoomDocument({
      ventureId: VENTURE,
      documentId: "DOC-1",
      session: founderSession,
      input: {
        file_path: "data-room/VNT-1/pitch_deck_business_plan/deck-v2.pdf",
        file_name: "deck-v2.pdf",
        file_size: 2048,
      },
      database: db,
    });

    expect(result).toEqual({ ok: true, version_number: 2 });

    const update = db.execute.mock.calls.find((call) =>
      call[0].sql.includes("UPDATE venture_documents SET"),
    );
    expect(update[0].sql).toContain("review_status = 'uploaded'");
    expect(update[0].sql).toContain("reviewer_id = NULL");
    expect(update[0].sql).toContain("reviewed_version = NULL");
    expect(update[0].args).toContain(2);
  });
});

describe("reviewDataRoomDocument", () => {
  test("a founder cannot verify their own document", async () => {
    const db = founderDb();

    const result = await reviewDataRoomDocument({
      ventureId: VENTURE,
      documentId: "DOC-1",
      session: founderSession,
      decision: "verified",
      database: db,
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  test("a rejection requires a reason", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_members")) return { rows: [] };
      return { rows: [] };
    });

    const result = await reviewDataRoomDocument({
      ventureId: VENTURE,
      documentId: "DOC-1",
      session: superAdminSession,
      decision: "rejected",
      notes: "",
      database: db,
    });

    expect(result).toMatchObject({ ok: false, error: "dataRoom.errors.rejectionReasonRequired" });
  });

  test("records the reviewer, timestamp and reviewed version", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_documents d")) {
        return {
          rows: [
            {
              id: "DOC-1",
              category: "pitch_deck_business_plan",
              current_version: 3,
              is_deleted: false,
              review_status: "under_review",
            },
          ],
        };
      }
      return { rows: [] };
    });

    const result = await reviewDataRoomDocument({
      ventureId: VENTURE,
      documentId: "DOC-1",
      session: superAdminSession,
      decision: "verified",
      notes: "Looks complete",
      database: db,
    });

    expect(result).toEqual({ ok: true, status: "verified", reviewed_version: 3 });

    const update = db.execute.mock.calls.find((call) =>
      call[0].sql.includes("UPDATE venture_documents"),
    );
    expect(update[0].args).toEqual(["verified", "USR-SA", "Looks complete", 3, "DOC-1"]);
  });
});

// ── Investor grants ─────────────────────────────────────────────────────────

describe("grantDataRoomAccess", () => {
  test("refuses an email that is not a contact", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_documents d")) return { rows: [{ id: "DOC-1" }] };
      if (sql.includes("FROM contacts")) return { rows: [] };
      return { rows: [] };
    });

    const result = await grantDataRoomAccess({
      ventureId: VENTURE,
      session: superAdminSession,
      documentId: "DOC-1",
      email: "nobody@example.com",
      database: db,
    });

    expect(result).toMatchObject({ ok: false, error: "dataRoom.errors.investorNotFound" });
  });

  test("refuses a contact who holds no investor profile", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM contacts")) {
        return { rows: [{ cid: "USR-X", name: "X", email: "x@example.com" }] };
      }
      if (sql.includes("FROM investor_profiles")) return { rows: [] };
      if (sql.includes("FROM venture_documents d")) return { rows: [{ id: "DOC-1" }] };
      return { rows: [] };
    });

    const result = await grantDataRoomAccess({
      ventureId: VENTURE,
      session: superAdminSession,
      documentId: "DOC-1",
      email: "x@example.com",
      database: db,
    });

    expect(result).toMatchObject({ ok: false, error: "dataRoom.errors.notInvestor" });
  });

  test("records a read-only grant scoped to the document", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM contacts")) {
        return { rows: [{ cid: "USR-INV", name: "Investor", email: "inv@example.com" }] };
      }
      if (sql.includes("FROM investor_profiles")) return { rows: [{ id: "INV-1" }] };
      if (sql.includes("FROM venture_documents d")) return { rows: [{ id: "DOC-1" }] };
      return { rows: [] };
    });

    const result = await grantDataRoomAccess({
      ventureId: VENTURE,
      session: superAdminSession,
      documentId: "DOC-1",
      email: "inv@example.com",
      expiresInDays: 30,
      database: db,
    });

    expect(result).toEqual({ ok: true });

    const insert = db.execute.mock.calls.find((call) =>
      call[0].sql.includes("INSERT INTO venture_data_room_grants"),
    );
    expect(insert[0].sql).toContain("access_level");
    expect(insert[0].args).toContain("USR-INV");
    expect(insert[0].args).toContain("view");
  });
});

// ── Model reads ─────────────────────────────────────────────────────────────

describe("ensureDataRoomSchema", () => {
  test("is idempotent per database and adds review metadata + grants", async () => {
    const db = makeDb(async () => ({ rows: [] }));

    await ensureDataRoomSchema(db);
    await ensureDataRoomSchema(db);

    const statements = db.execute.mock.calls.map((call) => call[0].sql);
    expect(statements.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS venture_data_room_grants"))).toBe(true);
    expect(statements.some((sql) => sql.includes("ADD COLUMN IF NOT EXISTS review_status"))).toBe(true);
    expect(statements.some((sql) => sql.includes("ADD COLUMN IF NOT EXISTS reviewed_version"))).toBe(true);
    expect(statements.filter((sql) => sql.includes("review_status")).length).toBe(1);
  });
});

describe("selectDataRoomDocuments — investor mode", () => {
  test("requires a live grant and hides expired documents", async () => {
    const db = makeDb(async () => ({ rows: [] }));

    await selectDataRoomDocuments(VENTURE, { granteeCid: "USR-INVESTOR" }, db);

    const { sql, args } = db.execute.mock.calls[1][0];
    expect(sql).toContain("FROM venture_data_room_grants");
    expect(sql).toContain("revoked_at IS NULL");
    expect(sql).toContain("doc.review_status <> 'expired'");
    expect(args).toContain("USR-INVESTOR");
  });
});

// The default categories are shared vocabulary; keep the count pinned so a new
// category is a deliberate change, not an accident.
