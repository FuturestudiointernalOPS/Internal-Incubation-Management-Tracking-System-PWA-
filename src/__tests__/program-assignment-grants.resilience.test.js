/**
 * ASSIGNMENT-DERIVED PROGRAM ACCESS — resilience.
 *
 * RESILIENCE: the optional profile-override column.
 *
 * `v2_program_staff.profile_key` (a profile KEY, since the profiles takeover) is
 * one REFINEMENT of the tick list (JSON overrides, then the assignment's
 * profile, then the program default). Before the column exists, a query that
 * NAMES it fails as a whole — which took the whole assignment derivation down,
 * and with it every gated request waiting on the migration batch.
 *
 * The read is therefore tolerant: try with the column, and if the column is
 * missing, retry once without it and remember that for the process. These
 * tests pin both halves — the fallback works, and it does not cost a failed
 * query on every call.
 *
 * The fake database and the fixtures live in
 * ./helpers/programAssignmentGrants.
 */

const mockGrants = require("./helpers/programAssignmentGrants");

jest.mock("@/lib/db", () => mockGrants.dbMock);
jest.mock("@/services/authorization/context", () => mockGrants.authorizationContextMock);

const {
  isMissingColumnError,
  listActiveProgramAssignments,
  resetAssignmentProfileColumnCache,
} = require("@/models/authorization/programAssignmentReads");
const { deriveFacilitatorDesiredCaps } = require("@/services/authorization/programAssignments");

const {
  resetState,
  CID,
  OPEN_END,
  OPEN_END_ID,
} = require("./helpers/programAssignmentGrants");

beforeEach(() => resetState());

/**
 * RESILIENCE: the optional profile-override column.
 *
 * `v2_program_staff.profile_key` is only a
 * REFINEMENT of the tick list (JSON overrides, then the assignment's profile,
 * then the program default). Before the column exists, a query that NAMES it
 * fails as a whole — which took the whole assignment derivation down, and with it
 * every gated request waiting on the migration batch.
 *
 * The read is therefore tolerant: try with the column, and if the column is what
 * is missing, retry once without it and remember that for the process. These
 * tests pin both halves — the fallback works, and it does not cost a failed query
 * on every call.
 */
describe("a database without the profile-override column still works", () => {
  const MISSING = 'column "profile_key" does not exist';

  beforeEach(() => {
    resetAssignmentProfileColumnCache();
  });

  test("the lookup error is recognised (and only for the right shape)", () => {
    expect(isMissingColumnError(new Error(MISSING))).toBe(true);
    expect(isMissingColumnError(new Error("no such column: profile_key"))).toBe(true);
    // Unrelated failures must keep propagating.
    expect(isMissingColumnError(new Error("connection terminated"))).toBe(false);
    expect(isMissingColumnError(new Error('column "other_col" does not exist'))).toBe(false);
  });

  test("the derivation falls back and still returns the assignment", async () => {
    const db = require("@/lib/db").default;
    let namingCalls = 0;
    db.execute.mockImplementation(async ({ sql }) => {
      // The real failure is NAMING the column (`ps.profile_key`). The
      // fallback's `NULL AS profile_key` is only an alias and is fine, so
      // the mock must distinguish the two the way Postgres does.
      if (String(sql).includes("ps.profile_key")) {
        namingCalls += 1;
        throw new Error(MISSING);
      }
      if (String(sql).includes("FROM v2_program_staff")) {
        return {
          rows: [
            {
              program_id: OPEN_END_ID,
              role_key: "facilitator",
              permissions: JSON.stringify({ "attendance.record": 2 }),
              profile_key: null,
              end_date: OPEN_END,
              status: "Active",
              is_archived: 0,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const { rows } = await listActiveProgramAssignments(CID);

    // The assignment survives; only the profile override is unavailable.
    expect(rows).toHaveLength(1);
    expect(rows[0].profile_key).toBeNull();
    const { desired } = deriveFacilitatorDesiredCaps(rows, {});
    expect(desired["facilitator.attendance.record"].level).toBe(2);
    // Asked once, learned, never asked again in this process.
    expect(namingCalls).toBe(1);

    const second = await listActiveProgramAssignments(CID);
    expect(second.rows).toHaveLength(1);
    expect(namingCalls).toBe(1);

    db.execute.mockImplementation(async () => ({ rows: [] }));
  });
});
