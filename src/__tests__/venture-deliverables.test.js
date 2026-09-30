/**
 * Deliverables — authority contract (agreed model).
 *
 *   define (create/edit) : Lead Manager or Super Admin
 *   review               : Lead Manager, Super Admin, or staff whose active
 *                          assignment scope covers the milestone / stage
 *
 * Pure helpers with an injected db double — no module mocking.
 */
const { canDefineDeliverables, canReviewDeliverable } = require("@/lib/ventureDeliverables");

jest.mock("@/lib/db", () => {
  const state = { executeImpl: async () => ({ rows: [] }) };
  return {
    __esModule: true,
    default: { execute: jest.fn(async (arg) => state.executeImpl(arg)) },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: mockState } = require("@/lib/db");

const VENTURE = "VNT-1";
const MILESTONE = "MS-1";
const STAGE = "ST-1";

/**
 * Install a db double and hand it back. `canReviewDeliverable` still reads
 * through the injected handle (its scope lookup is not migrated yet);
 * `canDefineDeliverables` reaches the same double through the module mock.
 */
function db({ assignments = [], lead = false, failAssignments = false } = {}) {
  const execute = async ({ sql, args = [] }) => {
    if (sql.includes("FROM venture_staff_assignments")) {
      if (failAssignments) throw new Error("assignments unavailable");
      if (lead) {
        return {
          rows: [
            {
              scope_type: "venture_wide",
              scope_ref_type: null,
              scope_ref_id: null,
              responsibility_code: "lead_manager",
            },
          ],
        };
      }
      return { rows: assignments };
    }
    // Definition authority is the matrix cell `milestones.edit`: the Lead
    // Manager holds it; nobody else in the seeded set does.
    if (sql.includes("venture_permission_matrix")) {
      return { rows: [{ allowed: args[0] === "lead_manager" ? 1 : 0 }] };
    }
    if (sql.includes("FROM ventures WHERE")) return { rows: [{ venture_id: VENTURE }] };
    return { rows: [] };
  };
  mockState.executeImpl = execute;
  return { execute };
}

describe("deliverable definition authority (Lead Manager / Super Admin)", () => {
  test("super_admin may define", async () => {
    db();
    expect(await canDefineDeliverables({ id: VENTURE, cid: "u1", role: "super_admin" })).toBe(true);
  });

  test("an assigned Lead Manager may define", async () => {
    db({ lead: true });
    expect(await canDefineDeliverables({ id: VENTURE, cid: "lm-1", role: "staff" })).toBe(true);
  });

  test("other staff may not define", async () => {
    db();
    expect(await canDefineDeliverables({ id: VENTURE, cid: "coach-1", role: "staff" })).toBe(false);
  });
});

describe("deliverable review authority", () => {
  test("super_admin may review", async () => {
    db();
    expect(await canReviewDeliverable({ id: VENTURE, cid: "u1", role: "super_admin", milestoneId: MILESTONE })).toBe(true);
  });

  test("a venture-wide assignment may review", async () => {
    db({ assignments: [{ scope_type: "venture_wide", scope_ref_id: null }] });
    expect(await canReviewDeliverable({ id: VENTURE, cid: "s1", role: "staff", milestoneId: MILESTONE })).toBe(true);
  });

  test("a lead_manager assignment may review regardless of scope column", async () => {
    db({ assignments: [{ scope_type: "milestone", scope_ref_id: "MS-OTHER", responsibility_code: "lead_manager" }] });
    expect(await canReviewDeliverable({ id: VENTURE, cid: "lm-1", role: "staff", milestoneId: MILESTONE })).toBe(true);
  });

  test("a coach scoped to THIS milestone may review", async () => {
    db({ assignments: [{ scope_type: "milestone", scope_ref_id: MILESTONE }] });
    expect(await canReviewDeliverable({ id: VENTURE, cid: "coach-1", role: "staff", milestoneId: MILESTONE })).toBe(true);
  });

  test("a coach scoped to a DIFFERENT milestone may not review", async () => {
    db({ assignments: [{ scope_type: "milestone", scope_ref_id: "MS-2" }] });
    expect(await canReviewDeliverable({ id: VENTURE, cid: "coach-1", role: "staff", milestoneId: MILESTONE })).toBe(false);
  });

  test("a coach scoped to the milestone's journey stage may review", async () => {
    db({ assignments: [{ scope_type: "journey_stage", scope_ref_id: STAGE }] });
    expect(
      await canReviewDeliverable({ id: VENTURE, cid: "coach-1", role: "staff", milestoneId: MILESTONE, journeyStageId: STAGE }),
    ).toBe(true);
  });

  test("staff with no assignment may not review", async () => {
    db();
    expect(await canReviewDeliverable({ id: VENTURE, cid: "s1", role: "staff", milestoneId: MILESTONE })).toBe(false);
  });

  test("members without a cid may not review", async () => {
    db();
    expect(await canReviewDeliverable({ id: VENTURE, cid: null, role: "member", milestoneId: MILESTONE })).toBe(false);
  });

  test("an unresolvable scope lookup fails closed", async () => {
    db({ failAssignments: true });
    expect(await canReviewDeliverable({ id: VENTURE, cid: "s1", role: "staff", milestoneId: MILESTONE })).toBe(false);
  });
});
