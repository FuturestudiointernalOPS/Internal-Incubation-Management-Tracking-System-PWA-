/**
 * The founder dashboard's work queue — what it is allowed to show.
 *
 * The queue is the one place where four overlapping lists from the API become a
 * single ordered list of rows. These tests pin that translation:
 *
 *   • a record appears ONCE, in the highest-priority group that lists it;
 *   • the order is the priority order the dashboard promises;
 *   • personal work and venture-wide work never share a row;
 *   • an empty queue is an empty array — not a fake row.
 *
 * No React rendering: the grouping is a pure shaper (ventureScreenModel), so it
 * is tested directly rather than through a component.
 */
import { groupWork, pickMyWork } from "@/components/participant/ventures/ventureScreenModel";

const item = (id, extra = {}) => ({ id, title: id, ...extra });

describe("pickMyWork", () => {
  it("returns the queue only from a successful payload", () => {
    expect(pickMyWork({ success: true, my_work: { personal: {} } })).toEqual({ personal: {} });
    // A refusal is not an empty queue.
    expect(pickMyWork({ success: false, error: "errors.insufficientPermissions" })).toBeNull();
    expect(pickMyWork({ success: true })).toBeNull();
  });
});

describe("groupWork", () => {
  it("orders the groups by what a founder must act on first", () => {
    const groups = groupWork({
      personal: {
        overdue: [item("task:1")],
        returned_for_changes: [item("task:2")],
        due_soon: [item("task:3")],
        awaiting_my_action: [item("task:4")],
        awaiting_review: [item("task:5")],
      },
      venture: { overdue: [item("task:6")], due_soon: [], awaiting_review: [] },
    });

    expect(groups.map((group) => group.key)).toEqual([
      "overdue",
      "returned",
      "dueSoon",
      "waiting",
      "withReviewer",
      "ventureWide",
    ]);
    expect(groups[5].items.map((row) => row.id)).toEqual(["task:6"]);
  });

  it("prints a record once — the first group that lists it wins", () => {
    // Task 9 is overdue AND was returned for changes: it must not be shown twice.
    const groups = groupWork({
      personal: {
        overdue: [item("task:9")],
        returned_for_changes: [item("task:9")],
        due_soon: [item("task:9")],
        awaiting_my_action: [item("task:9")],
        awaiting_review: [],
      },
      venture: {},
    });

    const printed = groups.flatMap((group) => group.items.map((row) => row.id));
    expect(printed).toEqual(["task:9"]);
    expect(groups[0].key).toBe("overdue");
  });

  it("keeps personal and venture-wide work in different groups", () => {
    const groups = groupWork({
      personal: { overdue: [item("task:mine")], due_soon: [], awaiting_my_action: [], returned_for_changes: [], awaiting_review: [] },
      venture: { overdue: [item("task:theirs")], due_soon: [], awaiting_review: [] },
    });

    expect(groups[0].items.map((row) => row.id)).toEqual(["task:mine"]);
    expect(groups[1].items.map((row) => row.id)).toEqual(["task:theirs"]);
    expect(groups[1].key).toBe("ventureWide");
  });

  it("reports work with a reviewer separately from work waiting on the founder", () => {
    const groups = groupWork({
      personal: {
        overdue: [],
        returned_for_changes: [],
        due_soon: [],
        awaiting_my_action: [item("deliverable:1")],
        awaiting_review: [item("deliverable:2")],
      },
      venture: {},
    });

    const byKey = Object.fromEntries(groups.map((group) => [group.key, group.items.map((row) => row.id)]));
    expect(byKey.waiting).toEqual(["deliverable:1"]);
    expect(byKey.withReviewer).toEqual(["deliverable:2"]);
  });

  it("drops empty groups instead of printing a heading with nothing under it", () => {
    const groups = groupWork({
      personal: { overdue: [], returned_for_changes: [], due_soon: [item("task:3")], awaiting_my_action: [], awaiting_review: [] },
      venture: {},
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("dueSoon");
  });

  it("returns nothing for an empty, missing or failed queue", () => {
    expect(groupWork({ personal: {}, venture: {} })).toEqual([]);
    expect(groupWork(null)).toEqual([]);
    expect(groupWork(undefined)).toEqual([]);
  });

  it("ignores a malformed entry rather than rendering a blank row", () => {
    const groups = groupWork({ personal: { overdue: [null, item("task:7")] }, venture: {} });
    expect(groups.flatMap((group) => group.items.map((row) => row.id))).toEqual(["task:7"]);
  });
});
