/**
 * Deliverable updates — one assignment per column.
 *
 * Reported failure: submitting evidence came back `API Error: multiple
 * assignments to same column "status"`. The file had uploaded, but the
 * submission was never recorded. The SET list was built by pushing fields — the
 * caller's `status` among them — and the approval workflow pushed the same
 * column a second time. SQLite takes the last one quietly; Postgres refuses the
 * statement. A review would have failed the same way on `reviewer_cid` and
 * `reviewer_name`, which the caller supplies too.
 */

const updates = [];
const reviewRows = [];

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    if (/^UPDATE venture_deliverables SET/.test(sql)) {
      updates.push({ sql, args });
      return { rows: [] };
    }
    if (/^INSERT INTO venture_deliverable_reviews/.test(sql)) {
      reviewRows.push({ sql, args });
      return { rows: [] };
    }
    // The row read back after the update, then the milestone recount.
    if (sql.startsWith("SELECT * FROM venture_deliverables")) {
      return { rows: [{ id: "dv-1", milestone_id: "ms-1", status: "in_progress" }] };
    }
    if (sql.includes("SELECT COUNT(*) as t")) return { rows: [{ t: 1, d: 0 }] };
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

const { updateDeliverable } = require("@/lib/ventures");

/** The `column = value` pairs of the UPDATE's SET list, in order. */
const setEntries = (sql) => sql.slice(sql.indexOf("SET ") + 4, sql.indexOf(" WHERE id = ?")).split(", ");

/** What each column is being set to: the bound argument, or the literal SQL. */
const setValues = (sql, args) => {
  const values = {};
  let next = 0;
  for (const entry of setEntries(sql)) {
    const [column, value] = entry.split(" = ");
    values[column] = value === "?" ? args[next++] : value;
  }
  return values;
};

/** Every column named more than once — the shape Postgres refuses. */
const columnsAssignedTwice = (sql) => {
  const columns = setEntries(sql).map((entry) => entry.split(" = ")[0]);
  return columns.filter((column, index) => columns.indexOf(column) !== index);
};

beforeEach(() => {
  updates.length = 0;
  reviewRows.length = 0;
});

describe("a deliverable submission", () => {
  test("assigns status once, carrying the submitted value", async () => {
    await updateDeliverable(
      "dv-1",
      {
        attachment_url: "deliverables/VNT-1/dv-1/1700000000000_plan.xlsx",
        attachment_name: "plan.xlsx",
        status: "submitted",
        approval_status: null,
      },
      "USR-founder",
      "Founder",
    );

    const { sql, args } = updates[0];
    expect(columnsAssignedTwice(sql)).toEqual([]);
    expect(setValues(sql, args)).toEqual({
      attachment_url: "deliverables/VNT-1/dv-1/1700000000000_plan.xlsx",
      attachment_name: "plan.xlsx",
      status: "submitted",
      approval_status: null,
      updated_at: "NOW()",
    });
    expect(args[args.length - 1]).toBe("dv-1");
  });
});

describe("a deliverable review", () => {
  test("approving completes it, naming each reviewer column once", async () => {
    await updateDeliverable(
      "dv-1",
      { approval_status: "approved", rejection_reason: null, reviewer_cid: "USR-lead", reviewer_name: "Lead Manager" },
      "USR-lead",
      "Lead Manager",
    );

    const { sql, args } = updates[0];
    expect(columnsAssignedTwice(sql)).toEqual([]);
    expect(setValues(sql, args)).toMatchObject({
      approval_status: "approved",
      status: "completed",
      reviewer_cid: "USR-lead",
      reviewer_name: "Lead Manager",
      reviewed_at: "NOW()",
    });
    expect(reviewRows[0].args).toEqual(["dv-1", "USR-lead", "Lead Manager", "approved", null]);
  });

  test("asking for changes leaves the status alone and keeps the reason", async () => {
    await updateDeliverable(
      "dv-1",
      {
        approval_status: "rejected",
        rejection_reason: "Please attach the signed version.",
        reviewer_cid: "USR-lead",
        reviewer_name: "Lead Manager",
      },
      "USR-lead",
      "Lead Manager",
    );

    const { sql, args } = updates[0];
    const values = setValues(sql, args);
    expect(columnsAssignedTwice(sql)).toEqual([]);
    expect(values).toMatchObject({
      approval_status: "rejected",
      rejection_reason: "Please attach the signed version.",
      reviewed_at: "NOW()",
    });
    expect("status" in values).toBe(false);
  });

  test("the reviewer falls back to whoever acted when none is named", async () => {
    await updateDeliverable("dv-1", { approval_status: "approved" }, "USR-lead", "Lead Manager");

    expect(setValues(updates[0].sql, updates[0].args)).toMatchObject({
      reviewer_cid: "USR-lead",
      reviewer_name: "Lead Manager",
      status: "completed",
    });
  });
});

describe("an update with nothing to write", () => {
  test("touches no row", async () => {
    expect(await updateDeliverable("dv-1", {}, "USR-1", "Someone")).toEqual({ updated: false });
    expect(updates).toEqual([]);
  });
});
