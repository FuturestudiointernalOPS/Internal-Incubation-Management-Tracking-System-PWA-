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
function respond(matcher, result, args = null) {
  responses.push({ matcher, result, args });
}

const mockQuery = jest.fn(async (sql, args = []) => {
  queryLog.push(sql.replace(/\s+/g, " ").trim());
  // The LAST registered matcher wins, so a test can override the happy path.
  for (const entry of [...responses].reverse()) {
    if (!sql.includes(entry.matcher)) continue;
    if (entry.args && entry.args.some((value, index) => value !== args[index])) continue;
    return entry.result;
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
  // Every optional module table is present on this database.
  respond("to_regclass", { rows: [{ name: "present" }] });
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
      skippedFamilies: [],
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

  test("a missing optional table skips its family instead of aborting", async () => {
    primeHappyPath();
    // `investor_profiles` does not exist on the measured production database.
    respond("to_regclass", { rows: [{ name: null }] }, ["public.investor_profiles"]);

    const result = await migrateLegacyIdentities();

    expect(result.skippedFamilies).toEqual(["investor"]);
    expect(result.investorCards).toBe(0);
    expect(result.cards).toBe(564); // participant 563 + founder 1
    // The skipped family's table is never referenced in a statement.
    expect(queryLog.some((sql) => sql.includes("investor_profiles"))).toBe(false);
    // The identity correction still runs for every label.
    expect(queryLog.some((sql) => sql.startsWith("UPDATE contacts"))).toBe(true);
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
