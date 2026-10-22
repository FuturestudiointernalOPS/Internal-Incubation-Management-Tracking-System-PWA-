/**
 * DATA ROOM — real PostgreSQL integration.
 *
 * Runs only when `DATAROOM_TEST_DATABASE_URL` points at a THROWAWAY database
 * (a local container, never staging or production). It exists because the unit
 * suite mocks the transport: it cannot tell whether the SQL this feature adds
 * actually parses, or whether the partial indexes and the derived expiry
 * behave. This suite does.
 *
 *   docker run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=impactos_test \
 *     -p 55432:5432 postgres:16-alpine
 *   DATAROOM_TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/impactos_test \
 *     npx jest src/__tests__/ventures/data-room-postgres.integration.test.js --runInBand
 */

const TEST_DATABASE_URL = process.env.DATAROOM_TEST_DATABASE_URL;
const describeIfDatabase = TEST_DATABASE_URL ? describe : describe.skip;

jest.mock("@/models/authorization/index", () => ({
  getAuthorizationContext: jest.fn(async (session) => ({ isSuperAdmin: session?.role === "super_admin" })),
}));
jest.mock("@/models/authorization/investorScope", () => ({
  resolveInvestorScope: jest.fn(async (session) =>
    session?.cid === "USR-INV"
      ? { management: false, profileId: "INV-1" }
      : { management: false, profileId: null },
  ),
}));
jest.mock("@/services/ventures/permissions", () => ({
  hasAnyVentureAssignment: jest.fn(async () => false),
  hasVentureCapability: jest.fn(async () => false),
}));
jest.mock("@/services/ventures/verification/categories", () => ({
  canManageVerification: jest.fn(async () => ({ allowed: false })),
}));
jest.mock("@/services/ventures/activity", () => ({
  notifyVentureFounders: jest.fn(async () => undefined),
}));
jest.mock("@/lib/ventureEvidence", () => ({
  signEvidencePath: jest.fn(async () => null),
  deleteEvidenceObject: jest.fn(async () => true),
}));

const { Client } = require("pg");
const {
  ensureDataRoomSchema,
  insertDataRoomDocument,
  insertDataRoomVersion,
  selectMaxDataRoomVersion,
  selectDataRoomDocuments,
  selectDataRoomDocument,
  selectDataRoomVersions,
  updateDataRoomReview,
  updateDataRoomDocument,
  insertDataRoomGrant,
  selectDataRoomGrantForPerson,
  revokeDataRoomGrant,
  selectDataRoomGrants,
  insertDataRoomRequirementSeeds,
  selectDataRoomRequirements,
  insertDataRoomActivity,
  selectDataRoomActivity,
} = require("@/models/ventureDataRoomStore");

const {
  createDataRoomDocument,
  reviewDataRoomDocument,
  grantDataRoomAccess,
  buildDataRoom,
} = require("@/services/ventures/dataRoom");

const VENTURE_UUID = "aaaaaaaa-1111-4111-8111-111111111111";
const DOC_A = "bbbbbbbb-1111-4111-8111-111111111111";
const DOC_B = "cccccccc-1111-4111-8111-111111111111";

let client;
let database;

/** The `?`-placeholder transport the application uses, over one real client. */
function makeDatabase(pgClient) {
  return {
    execute: async ({ sql, args = [] }) => {
      let index = 0;
      const text = sql.replace(/\?/g, () => `$${++index}`);
      const result = await pgClient.query(text, args);
      return { rows: result.rows, rowsAffected: result.rowCount };
    },
  };
}

const SETUP_SQL = `
CREATE TABLE ventures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id TEXT UNIQUE NOT NULL,
  name TEXT,
  company_name TEXT,
  description TEXT,
  industry TEXT,
  country TEXT,
  business_stage TEXT
);
CREATE TABLE contacts (cid TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, status TEXT);
CREATE TABLE venture_members (
  id SERIAL PRIMARY KEY,
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  contact_id TEXT,
  user_cid TEXT,
  member_type TEXT,
  role TEXT,
  lead_founder BOOLEAN DEFAULT FALSE,
  is_owner BOOLEAN DEFAULT FALSE,
  removed_at TIMESTAMP,
  suspended_at TIMESTAMP,
  joined_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE venture_staff_assignments (
  id SERIAL PRIMARY KEY, venture_id UUID NOT NULL, staff_contact_id TEXT,
  responsibility_code TEXT, status TEXT, scope_type TEXT, scope_ref_type TEXT, scope_ref_id TEXT
);
CREATE TABLE investor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, approval_status TEXT
);
CREATE TABLE venture_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  folder TEXT,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  approval_status TEXT NOT NULL DEFAULT 'private',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT,
  description TEXT,
  document_type TEXT NOT NULL DEFAULT 'other',
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  thumbnail_url TEXT,
  current_version INTEGER DEFAULT 1,
  is_pitch_deck BOOLEAN DEFAULT FALSE
);
CREATE TABLE venture_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  version INTEGER,
  file_name TEXT,
  file_size BIGINT,
  change_notes TEXT,
  version_notes TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, version_number)
);
CREATE TABLE venture_activity_log (
  id SERIAL PRIMARY KEY, venture_id UUID, action TEXT, actor_cid TEXT,
  actor_name TEXT, details TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

describeIfDatabase("Data Room against real PostgreSQL", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    await client.query(SETUP_SQL);
    await client.query(
      "INSERT INTO ventures (id, venture_id, company_name, business_stage) VALUES ($1, 'VNT-1', 'Test Venture', 'idea')",
      [VENTURE_UUID],
    );
    await client.query("INSERT INTO contacts (cid, name, email) VALUES ('USR-F', 'Founder', 'f@example.com')");
    await client.query("INSERT INTO contacts (cid, name, email) VALUES ('USR-INV', 'Investor', 'inv@example.com')");
    await client.query(
      `INSERT INTO venture_members (venture_id, contact_id, member_type, lead_founder)
       VALUES ($1, 'USR-F', 'founder', TRUE)`,
      [VENTURE_UUID],
    );
    await client.query(
      "INSERT INTO investor_profiles (user_id, approval_status) VALUES ('USR-INV', 'approved')",
    );
    database = makeDatabase(client);
    await ensureDataRoomSchema(database);
  });

  afterAll(async () => {
    if (!client) return;
    await client.query("DROP TABLE IF EXISTS venture_data_room_grants, venture_data_room_requirements CASCADE");
    await client.query("DROP TABLE IF EXISTS venture_activity_log, venture_document_versions, venture_documents CASCADE");
    await client.query("DROP TABLE IF EXISTS investor_profiles, venture_staff_assignments, venture_members, contacts, ventures CASCADE");
    await client.end();
  });

  test("the additive schema lands on a real document table", async () => {
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'venture_documents'
         AND column_name IN ('review_status','reviewer_id','reviewed_at','review_notes','reviewed_version','expires_at','deleted_at')`,
    );
    expect(result.rows.map((row) => row.column_name).sort()).toEqual([
      "deleted_at",
      "expires_at",
      "review_notes",
      "review_status",
      "reviewed_at",
      "reviewed_version",
      "reviewer_id",
    ]);
  });

  test("a document, its version 1 and its review are persisted", async () => {
    await insertDataRoomDocument(
      {
        ventureId: VENTURE_UUID,
        title: "Pitch deck",
        description: "Seed round",
        category: "pitch_deck_business_plan",
        fileName: "deck.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        storagePath: `data-room/VNT-1/pitch_deck_business_plan/${DOC_A}.pdf`,
        uploadedBy: "USR-F",
        isPitchDeck: true,
      },
      database,
    );

    // The insert returns an id; use it for the version.
    const list = await selectDataRoomDocuments(VENTURE_UUID, {}, database);
    const documentId = list.rows[0].id;
    await insertDataRoomVersion(
      {
        documentId,
        versionNumber: 1,
        fileName: "deck.pdf",
        fileSize: 1024,
        fileType: "application/pdf",
        storagePath: `data-room/VNT-1/pitch_deck_business_plan/${DOC_A}.pdf`,
        notes: "v1",
        uploadedBy: "USR-F",
      },
      database,
    );

    const versions = await selectDataRoomVersions(VENTURE_UUID, documentId, database);
    expect(versions.rows).toHaveLength(1);
    expect(versions.rows[0].version_number).toBe(1);
    expect((await selectMaxDataRoomVersion(documentId, database)).rows[0].max_version).toBe(1);

    await updateDataRoomReview(
      { documentId, status: "verified", reviewerId: "USR-SA", notes: "ok", reviewedVersion: 1 },
      database,
    );
    const detail = await selectDataRoomDocument(VENTURE_UUID, documentId, {}, database);
    expect(detail.rows[0].review_status).toBe("verified");
    expect(detail.rows[0].review_status_effective).toBe("verified");

    // A second version moves the pointer and the history keeps both.
    await insertDataRoomVersion(
      {
        documentId,
        versionNumber: 2,
        fileName: "deck-v2.pdf",
        fileSize: 2048,
        fileType: "application/pdf",
        storagePath: `data-room/VNT-1/pitch_deck_business_plan/${DOC_A}-v2.pdf`,
        notes: "v2",
        uploadedBy: "USR-F",
      },
      database,
    );
    await updateDataRoomDocument(
      ["current_version = ?", "review_status = 'uploaded'", "reviewer_id = NULL", "reviewed_at = NULL", "review_notes = NULL", "reviewed_version = NULL", "updated_at = NOW()"],
      [2, documentId],
      database,
    );

    const afterVersion = await selectDataRoomDocument(VENTURE_UUID, documentId, {}, database);
    expect(afterVersion.rows[0].current_version).toBe(2);
    expect(afterVersion.rows[0].review_status_effective).toBe("uploaded");
    expect((await selectDataRoomVersions(VENTURE_UUID, documentId, database)).rows).toHaveLength(2);
  });

  test("expiry is derived without rewriting the reviewer's decision", async () => {
    const list = await selectDataRoomDocuments(VENTURE_UUID, {}, database);
    const documentId = list.rows[0].id;
    await updateDataRoomDocument(
      ["expires_at = NOW() - INTERVAL '1 day'", "review_status = 'verified'"],
      [documentId],
      database,
    );

    const detail = await selectDataRoomDocument(VENTURE_UUID, documentId, {}, database);
    expect(detail.rows[0].review_status).toBe("verified");
    expect(detail.rows[0].review_status_effective).toBe("expired");

    // The CATALOGUE filters on the derived value, not the stored one.
    const expired = await selectDataRoomDocuments(VENTURE_UUID, { status: "expired" }, database);
    expect(expired.rows.map((row) => row.id)).toContain(documentId);
    const stillVerified = await selectDataRoomDocuments(VENTURE_UUID, { status: "verified" }, database);
    expect(stillVerified.rows.map((row) => row.id)).not.toContain(documentId);

    await updateDataRoomDocument(["expires_at = NULL"], [documentId], database);
  });

  test("an investor sees only the granted document, and revocation closes the door", async () => {
    // A second document nobody granted.
    const second = await insertDataRoomDocument(
      {
        ventureId: VENTURE_UUID,
        title: "Cap table",
        category: "fundraising_cap_table",
        fileName: "cap.xlsx",
        fileSize: 512,
        fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        storagePath: `data-room/VNT-1/fundraising_cap_table/${DOC_B}.xlsx`,
        uploadedBy: "USR-F",
      },
      database,
    );
    const secondId = second.rows[0].id;

    const first = (await selectDataRoomDocuments(VENTURE_UUID, {}, database)).rows.find(
      (row) => row.category === "pitch_deck_business_plan",
    );

    await insertDataRoomGrant(
      {
        ventureId: VENTURE_UUID,
        documentId: first.id,
        granteeCid: "USR-INV",
        grantedBy: "USR-F",
      },
      database,
    );

    const granted = await selectDataRoomDocuments(VENTURE_UUID, { granteeCid: "USR-INV" }, database);
    expect(granted.rows.map((row) => row.id)).toEqual([first.id]);
    expect(granted.rows.map((row) => row.id)).not.toContain(secondId);

    expect((await selectDataRoomGrantForPerson(VENTURE_UUID, "USR-INV", database)).rows).toHaveLength(1);
    expect((await selectDataRoomDocuments(VENTURE_UUID, { granteeCid: "USR-OTHER" }, database)).rows).toHaveLength(0);

    const grants = await selectDataRoomGrants(VENTURE_UUID, database);
    expect(grants.rows).toHaveLength(1);
    expect(grants.rows[0].grantee_email).toBe("inv@example.com");
    await expect(revokeDataRoomGrant(VENTURE_UUID, grants.rows[0].id, "USR-F", database)).resolves.toMatchObject({
      rowsAffected: 1,
    });

    expect((await selectDataRoomDocuments(VENTURE_UUID, { granteeCid: "USR-INV" }, database)).rows).toHaveLength(0);
  });

  test("category grants cover existing documents, not only one file", async () => {
    const docs = await selectDataRoomDocuments(VENTURE_UUID, {}, database);
    const capTable = docs.rows.find((row) => row.category === "fundraising_cap_table");
    expect(capTable).toBeTruthy();

    await insertDataRoomGrant(
      {
        ventureId: VENTURE_UUID,
        category: "fundraising_cap_table",
        granteeCid: "USR-INV",
        grantedBy: "USR-F",
      },
      database,
    );

    const granted = await selectDataRoomDocuments(VENTURE_UUID, { granteeCid: "USR-INV" }, database);
    expect(granted.rows.map((row) => row.category)).toEqual(["fundraising_cap_table"]);
  });

  test("the catalogue filters by category, status and search from real SQL", async () => {
    const byCategory = await selectDataRoomDocuments(
      VENTURE_UUID,
      { category: "fundraising_cap_table" },
      database,
    );
    expect(byCategory.rows.map((row) => row.category)).toEqual(["fundraising_cap_table"]);

    const bySearch = await selectDataRoomDocuments(VENTURE_UUID, { search: "cap table" }, database);
    expect(bySearch.rows).toHaveLength(1);

    const byStatus = await selectDataRoomDocuments(VENTURE_UUID, { status: "verified" }, database);
    expect(byStatus.rows).toHaveLength(1);
    expect(byStatus.rows[0].category).toBe("pitch_deck_business_plan");

    const uploaded = await selectDataRoomDocuments(VENTURE_UUID, { status: "uploaded" }, database);
    expect(uploaded.rows.length).toBeGreaterThan(0);
  });

  test("requirements are per venture and idempotent", async () => {
    await insertDataRoomRequirementSeeds(
      VENTURE_UUID,
      [
        { category: "company_overview", level: "recommended" },
        { category: "pitch_deck_business_plan", level: "required" },
      ],
      "idea",
      database,
    );
    await insertDataRoomRequirementSeeds(
      VENTURE_UUID,
      [
        { category: "company_overview", level: "required" },
        { category: "pitch_deck_business_plan", level: "required" },
      ],
      "growth",
      database,
    );

    const rows = await selectDataRoomRequirements(VENTURE_UUID, database);
    expect(rows.rows).toHaveLength(2);
    // The first seed wins: ON CONFLICT DO NOTHING.
    expect(rows.rows.find((row) => row.category === "company_overview").level).toBe("recommended");
  });

  test("the audit trail is written and read back", async () => {
    await insertDataRoomActivity(
      {
        ventureRef: VENTURE_UUID,
        action: "DATA_ROOM_DOCUMENT_UPLOADED",
        actorCid: "USR-F",
        actorName: "Founder",
        detailsJson: JSON.stringify({ document_id: DOC_A, category: "pitch_deck_business_plan" }),
      },
      database,
    );

    const events = await selectDataRoomActivity(VENTURE_UUID, database);
    expect(events.rows.some((row) => row.action === "DATA_ROOM_DOCUMENT_UPLOADED")).toBe(true);
    const event = events.rows.find((row) => row.action === "DATA_ROOM_DOCUMENT_UPLOADED");
    expect(JSON.parse(event.details).document_id).toBe(DOC_A);
  });

  test("the service composes the whole flow: upload → review → grant → investor read", async () => {
    const founder = { cid: "USR-F", role: "member", name: "Founder" };
    const admin = { cid: "USR-SA", role: "super_admin", name: "Super Admin" };
    const investor = { cid: "USR-INV", role: "member", name: "Investor" };

    const created = await createDataRoomDocument({
      ventureId: VENTURE_UUID,
      session: founder,
      input: {
        title: "Due diligence pack",
        category: "due_diligence",
        file_path: `data-room/${VENTURE_UUID}/due_diligence/service-flow.pdf`,
        file_name: "service-flow.pdf",
        file_size: 2048,
        file_type: "application/pdf",
      },
      database,
    });
    expect(created.ok).toBe(true);

    // Uploading is not verifying: the founder cannot verify their own document.
    const selfReview = await reviewDataRoomDocument({
      ventureId: VENTURE_UUID,
      documentId: created.document_id,
      session: founder,
      decision: "verified",
      database,
    });
    expect(selfReview).toMatchObject({ ok: false, status: 403 });

    const reviewed = await reviewDataRoomDocument({
      ventureId: VENTURE_UUID,
      documentId: created.document_id,
      session: admin,
      decision: "verified",
      notes: "Complete",
      database,
    });
    expect(reviewed).toMatchObject({ ok: true, status: "verified", reviewed_version: 1 });

    const granted = await grantDataRoomAccess({
      ventureId: VENTURE_UUID,
      session: founder,
      documentId: created.document_id,
      email: "inv@example.com",
      database,
    });
    expect(granted).toEqual({ ok: true });

    const investorRoom = await buildDataRoom({
      ventureId: VENTURE_UUID,
      session: investor,
      database,
    });
    expect(investorRoom.ok).toBe(true);
    const visible = investorRoom.documents.map((row) => row.id);
    expect(visible).toContain(created.document_id);
    // The pitch deck was never granted to this investor.
    expect(visible).not.toContain(
      (await selectDataRoomDocuments(VENTURE_UUID, {}, database)).rows.find(
        (row) => row.category === "pitch_deck_business_plan",
      ).id,
    );
    expect(investorRoom.viewer.can_manage).toBe(false);
    expect(investorRoom.grants).toEqual([]);
  });
});
