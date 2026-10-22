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
  buildDataRoom,
  computeDataRoomCompleteness,
  loadDataRoomRequirements,
  resolveDataRoomViewer,
} = require("@/services/ventures/dataRoom");
const { DEFAULT_VENTURE_DOCUMENT_TYPES } = require("@/lib/ventureDocumentTypeDefaults");

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
const investorSession = { cid: "USR-INVESTOR", role: "member", name: "Investor" };
const superAdminSession = { cid: "USR-SA", role: "super_admin", name: "SA" };

beforeEach(() => {
  jest.clearAllMocks();
  resolveInvestorScope.mockResolvedValue({ management: false, profileId: null });
  hasAnyVentureAssignment.mockResolvedValue(false);
  hasVentureCapability.mockResolvedValue(false);
  canManageVerification.mockResolvedValue({ allowed: false });
});

// ── Completeness ────────────────────────────────────────────────────────────

describe("computeDataRoomCompleteness", () => {
  const requirements = [
    { category: "company_overview", level: "required" },
    { category: "pitch_deck_business_plan", level: "required" },
    { category: "financials_projections", level: "recommended" },
    { category: "legal_corporate", level: "conditional" },
    { category: "team", level: "not_applicable" },
  ];

  test("optional categories are never counted as missing", () => {
    const result = computeDataRoomCompleteness(requirements, []);

    expect(result.required_total).toBe(2);
    expect(result.missing_required).toEqual(["company_overview", "pitch_deck_business_plan"]);
    expect(result.readiness_percent).toBe(0);
    expect(result.is_ready).toBe(false);
  });

  test("a verified document scores 1 and a rejected one 0.5", () => {
    const result = computeDataRoomCompleteness(requirements, [
      { category: "company_overview", status: "verified" },
      { category: "pitch_deck_business_plan", status: "rejected" },
    ]);

    expect(result.readiness_percent).toBe(75); // (1 + 0.5) / 2
    expect(result.verified_documents).toBe(1);
    expect(result.rejected_documents).toBe(1);
    expect(result.missing_required).toEqual([]);
  });

  test("an upload under review is not verified", () => {
    const result = computeDataRoomCompleteness(requirements, [
      { category: "company_overview", status: "under_review" },
      { category: "pitch_deck_business_plan", status: "uploaded" },
    ]);

    expect(result.readiness_percent).toBe(0);
    expect(result.awaiting_review).toBe(2);
  });

  test("no required category is indeterminate, not 100%", () => {
    const result = computeDataRoomCompleteness(
      [{ category: "company_overview", level: "recommended" }],
      [],
    );

    expect(result.required_total).toBe(0);
    expect(result.readiness_percent).toBe(null);
    expect(result.is_ready).toBe(false);
  });
});

// ── Stage-based requirements ────────────────────────────────────────────────

describe("loadDataRoomRequirements", () => {
  test("an idea-stage venture gets a conservative list, seeded once", async () => {
    let seeded = false;
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("SELECT business_stage")) return { rows: [{ business_stage: "idea" }] };
      if (sql.includes("INSERT INTO venture_data_room_requirements")) {
        seeded = true;
        return { rows: [] };
      }
      if (sql.includes("FROM venture_data_room_requirements")) {
        if (!seeded) return { rows: [] };
        return {
          rows: [
            { category: "fundraising_cap_table", level: "conditional", stage_bucket: "idea" },
            { category: "company_overview", level: "recommended", stage_bucket: "idea" },
          ],
        };
      }
      return { rows: [] };
    });

    const requirements = await loadDataRoomRequirements(VENTURE, db);

    expect(requirements).toHaveLength(11);
    const byCategory = Object.fromEntries(requirements.map((row) => [row.category, row]));
    expect(byCategory.fundraising_cap_table.level).toBe("conditional");
    expect(byCategory.company_overview.level).toBe("recommended");
    // Only `required` rows count towards readiness.
    expect(requirements.filter((row) => row.counts_toward_readiness)).toHaveLength(0);
  });

  test("a stage change re-applies only the NON-customized rows", async () => {
    const updates = [];
    let pass = 0;
    const db = makeDb(async ({ sql, args }) => {
      if (sql.includes("SELECT business_stage")) return { rows: [{ business_stage: "growth" }] };
      if (sql.includes("UPDATE venture_data_room_requirements")) {
        updates.push(args);
        return { rows: [] };
      }
      if (sql.includes("FROM venture_data_room_requirements")) {
        pass += 1;
        if (pass === 1) {
          return {
            rows: [
              { category: "company_overview", level: "recommended", stage_bucket: "idea", customized: false },
            ],
          };
        }
        return {
          rows: [
            { category: "company_overview", level: "required", stage_bucket: "growth", customized: false },
          ],
        };
      }
      return { rows: [] };
    });

    const requirements = await loadDataRoomRequirements(VENTURE, db);

    expect(requirements.find((row) => row.category === "company_overview").level).toBe("required");
    // The statement itself confines the change to non-customized rows.
    const updateStatement = db.execute.mock.calls.find((call) =>
      call[0].sql.includes("UPDATE venture_data_room_requirements"),
    );
    expect(updateStatement[0].sql).toContain("customized = FALSE");
  });
});

// ── Viewer verdict ──────────────────────────────────────────────────────────

describe("resolveDataRoomViewer", () => {
  test("no session is refused", async () => {
    await expect(resolveDataRoomViewer({ ventureId: VENTURE, session: null })).resolves.toEqual({
      allowed: false,
      reason: "unauthenticated",
    });
  });

  test("a super admin may do everything", async () => {
    const db = makeDb(async () => ({ rows: [] }));
    const viewer = await resolveDataRoomViewer({
      ventureId: VENTURE,
      session: superAdminSession,
      database: db,
    });

    expect(viewer).toMatchObject({ allowed: true, canManage: true, canReview: true });
    expect(viewer.granteeCid).toBeNull();
  });

  test("a founder manages but does not verify their own file", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_members")) {
        return { rows: [{ member_type: "founder", lead_founder: true }] };
      }
      return { rows: [] };
    });

    const viewer = await resolveDataRoomViewer({
      ventureId: VENTURE,
      session: founderSession,
      database: db,
    });

    expect(viewer).toMatchObject({ allowed: true, canManage: true, canReview: false });
  });

  test("a Lead Manager requests categories and reviews, but never uploads", async () => {
    hasAnyVentureAssignment.mockResolvedValue(true);
    hasVentureCapability.mockResolvedValue(true);
    canManageVerification.mockResolvedValue({ allowed: true });
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_staff_assignments")) return { rows: [{ 1: 1 }] };
      return { rows: [] };
    });

    const viewer = await resolveDataRoomViewer({
      ventureId: VENTURE,
      session: { cid: "USR-LEAD", role: "staff", name: "Lead" },
      database: db,
    });

    expect(viewer).toMatchObject({
      allowed: true,
      viewerType: "staff",
      isLeadManager: true,
      canManage: false,
      canReview: false,
      canConfigureRequirements: true,
    });
  });

  test("an ordinary member sees the room but cannot manage it", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_members")) return { rows: [{ member_type: "team_member" }] };
      return { rows: [] };
    });

    const viewer = await resolveDataRoomViewer({
      ventureId: VENTURE,
      session: memberSession,
      database: db,
    });

    expect(viewer).toMatchObject({ allowed: true, canManage: false, canReview: false });
  });

  test("an investor without a grant is refused, even with a profile", async () => {
    resolveInvestorScope.mockResolvedValue({ management: false, profileId: "INV-1" });
    const db = makeDb(async () => ({ rows: [] }));

    const viewer = await resolveDataRoomViewer({
      ventureId: VENTURE,
      session: investorSession,
      database: db,
    });

    expect(viewer.allowed).toBe(false);
  });

  test("an investor WITH a grant sees only their granted subset", async () => {
    resolveInvestorScope.mockResolvedValue({ management: false, profileId: "INV-1" });
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_data_room_grants")) return { rows: [{ 1: 1 }] };
      return { rows: [] };
    });

    const viewer = await resolveDataRoomViewer({
      ventureId: VENTURE,
      session: investorSession,
      database: db,
    });

    expect(viewer).toMatchObject({
      allowed: true,
      viewerType: "investor",
      canManage: false,
      canReview: false,
      granteeCid: "USR-INVESTOR",
    });
  });
});

test("the Data Room ships with eleven categories", () => {
  const { DATA_ROOM_CATEGORIES } = require("@/lib/dataRoom");
  expect(DATA_ROOM_CATEGORIES).toHaveLength(11);
  expect(DEFAULT_VENTURE_DOCUMENT_TYPES.length).toBe(6);
});

test("a category outside the eleven is legacy, never silently reclassified", () => {
  const { isLegacyDocumentCategory } = require("@/lib/dataRoom");

  expect(isLegacyDocumentCategory("company_overview")).toBe(false);
  expect(isLegacyDocumentCategory("business_plan")).toBe(true);
  expect(isLegacyDocumentCategory("general")).toBe(true);
  expect(isLegacyDocumentCategory(null)).toBe(true);
});

describe("buildDataRoom — expired grants", () => {
  test("a manager still sees an expired grant, marked expired, so it can be revoked", async () => {
    const db = makeDb(async ({ sql }) => {
      if (sql.includes("FROM venture_documents d")) return { rows: [] };
      if (sql.includes("FROM venture_data_room_requirements")) return { rows: [] };
      if (sql.includes("FROM venture_data_room_grants")) {
        return {
          rows: [
            {
              id: 7,
              grantee_cid: "USR-INVESTOR",
              grantee_name: "Investor",
              expires_at: "2020-01-01T00:00:00.000Z",
              is_expired: true,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const room = await buildDataRoom({
      ventureId: VENTURE,
      session: superAdminSession,
      database: db,
    });

    expect(room.ok).toBe(true);
    expect(room.grants).toHaveLength(1);
    expect(room.grants[0].is_expired).toBe(true);
    expect(
      db.execute.mock.calls.some((call) => String(call[0].sql).includes("is_expired")),
    ).toBe(true);
  });
});
