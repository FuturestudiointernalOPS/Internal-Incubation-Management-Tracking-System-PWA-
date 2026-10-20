/**
 * THE AUTOMATIC LEGACY-IDENTITY MIGRATION (model).
 *
 * Locks the two things that matter and cannot be read from the SQL alone:
 *   - the ORDER: every card is written BEFORE the identity becomes member;
 *   - the GUARD: a surviving label or an uncovered active relationship throws,
 *     so the caller's transaction rolls back.
 */

const queryLog = [];

const responses = [];
function respond(matcher, result) {
  responses.push({ matcher, result });
}

const mockQuery = jest.fn(async (sql) => {
  queryLog.push(sql.replace(/\s+/g, " ").trim());
  // The LAST registered matcher wins, so a test can override the happy path.
  for (const entry of [...responses].reverse()) {
    if (sql.includes(entry.matcher)) return entry.result;
  }
  return { rows: [], rowsAffected: 0 };
});

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (callback) => callback(mockQuery)),
    execute: jest.fn(),
  },
}));

const {
  migrateLegacyIdentities,
  LEGACY_IDENTITY_ROLES,
} = require("@/models/authorization/legacyIdentityStore");

function primeHappyPath() {
  respond("CREATE TEMP TABLE legacy_migration_relationships", { rows: [] });
  respond("GROUP BY source_role", {
    rows: [
      { source_role: "participant", has_relationship: true, people: 563 },
      { source_role: "facilitator", has_relationship: false, people: 5 },
      { source_role: "founder", has_relationship: true, people: 1 },
    ],
  });
  respond("'participant', 'program'", { rows: [], rowsAffected: 563 });
  respond("'facilitator', 'program'", { rows: [], rowsAffected: 0 });
  respond("'founder', 'venture'", { rows: [], rowsAffected: 1 });
  respond("'investor', 'investor'", { rows: [], rowsAffected: 0 });
  respond("UPDATE contacts", { rows: [], rowsAffected: 569 });
  respond(
    "FROM contacts WHERE role IN ('participant', 'facilitator', 'investor', 'founder')",
    { rows: [{ n: 0 }] },
  );
  respond("t.has_relationship", { rows: [{ n: 0 }] });
  respond("WHERE NOT has_relationship", { rows: [{ n: 5 }] });
}

beforeEach(() => {
  queryLog.length = 0;
  responses.length = 0;
  mockQuery.mockClear();
});

describe("migrateLegacyIdentities", () => {
  test("writes every card before changing the identity", async () => {
    primeHappyPath();

    const result = await migrateLegacyIdentities();

    const updateIndex = queryLog.findIndex((sql) => sql.startsWith("UPDATE contacts"));
    const insertIndexes = queryLog
      .map((sql, index) =>
        sql.includes("INSERT INTO profile_assignments") ? index : -1,
      )
      .filter((index) => index >= 0);

    expect(insertIndexes).toHaveLength(4);
    expect(Math.max(...insertIndexes)).toBeLessThan(updateIndex);
    expect(result).toMatchObject({
      cards: 564,
      updated: 569,
      withoutRelationship: 5,
    });
  });

  test("a surviving legacy label aborts the transaction", async () => {
    primeHappyPath();
    respond(
      "FROM contacts WHERE role IN ('participant', 'facilitator', 'investor', 'founder')",
      { rows: [{ n: 2 }] },
    );

    await expect(migrateLegacyIdentities()).rejects.toThrow(/2 label/);
  });

  test("an active relationship without a card aborts the transaction", async () => {
    primeHappyPath();
    respond("t.has_relationship", { rows: [{ n: 1 }] });

    await expect(migrateLegacyIdentities()).rejects.toThrow(
      /1 active relationship/,
    );
  });

  test("the retired labels are declared in one place", () => {
    expect([...LEGACY_IDENTITY_ROLES].sort()).toEqual([
      "facilitator",
      "founder",
      "investor",
      "participant",
    ]);
  });
});
